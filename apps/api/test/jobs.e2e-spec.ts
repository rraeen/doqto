import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { type Connection, type Model, Types } from 'mongoose';
import { Appointment } from '../src/appointments/appointment.schema';
import { addDays, istDate, istDayRange } from '../src/common/time/ist';
import { EndOfDayService, END_OF_DAY_JOB, endOfDayKey } from '../src/jobs/end-of-day.service';
import { Job } from '../src/jobs/job.schema';
import { JOB_LEASE_MS, JobsService } from '../src/jobs/jobs.service';
import { DoctorStatusEntity } from '../src/status/doctor-status.schema';
import { createTestApp } from './app';

describe('jobs framework (BE-19) and end-of-day close (BE-20)', () => {
  let app: INestApplication;
  let db: Connection;
  let jobs: JobsService;
  let jobModel: Model<Job>;
  const ran: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    jobs = app.get(JobsService);
    jobModel = app.get(getModelToken(Job.name));
    jobs.register('e2e-record', async (payload) => {
      ran.push(String(payload.n));
      await new Promise((r) => setTimeout(r, 2));
    });
    jobs.register('e2e-fail', () => Promise.reject(new Error('BSP said no to +919812345678')));
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  it('two workers never claim the same job', async () => {
    const n = 40;
    await Promise.all(Array.from({ length: n }, (_, i) => jobs.enqueue('e2e-record', { n: i })));
    const claimedBy = async (worker: string) => {
      const ids: string[] = [];
      for (;;) {
        const j = await jobs.claim(worker);
        if (!j) return ids;
        ids.push(j._id.toHexString());
        await jobs.complete(j);
      }
    };
    const [a, b, c] = await Promise.all([claimedBy('w1'), claimedBy('w2'), claimedBy('w3')]);
    const all = [...a, ...b, ...c];
    expect(all).toHaveLength(n);
    expect(new Set(all).size).toBe(n);
    expect(await jobModel.countDocuments({ type: 'e2e-record', status: 'done' })).toBe(n);
  });

  it('runs handlers through drain, each job once', async () => {
    ran.length = 0;
    await Promise.all([1, 2, 3].map((n) => jobs.enqueue('e2e-record', { n })));
    const counts = await Promise.all([jobs.drain(10, 'a'), jobs.drain(10, 'b')]);
    expect(counts[0] + counts[1]).toBe(3);
    expect(ran.sort()).toEqual(['1', '2', '3']);
  });

  it('a dedupe key enqueues once', async () => {
    const first = await jobs.enqueue('e2e-record', { n: 'x' }, { dedupeKey: 'e2e:once' });
    const again = await jobs.enqueue('e2e-record', { n: 'y' }, { dedupeKey: 'e2e:once' });
    expect(again._id.equals(first._id)).toBe(true);
    expect(await jobModel.countDocuments({ dedupeKey: 'e2e:once' })).toBe(1);
    await jobs.drain();
  });

  it('retries with backoff, scrubs the error and gives up after maxAttempts', async () => {
    const j = await jobs.enqueue('e2e-fail', {}, { maxAttempts: 2 });
    expect(await jobs.runOne()).toBe(true);
    let doc = (await jobModel.findById(j._id).lean())!;
    expect(doc).toMatchObject({ status: 'queued', attempts: 1 });
    expect(doc.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    expect(doc.lastError).not.toContain('9812345678');
    expect(await jobs.runOne()).toBe(false); // not due yet
    await jobModel.updateOne({ _id: j._id }, { $set: { runAt: new Date() } });
    await jobs.runOne();
    doc = (await jobModel.findById(j._id).lean())!;
    expect(doc).toMatchObject({ status: 'failed', attempts: 2 });
    expect(doc.finishedAt).toBeDefined();
  });

  it('a job whose worker died is claimed again after its lease', async () => {
    const j = await jobs.enqueue('e2e-record', { n: 'lease' });
    const claimed = await jobs.claim('dead-worker');
    expect(claimed!._id.equals(j._id)).toBe(true);
    expect(await jobs.claim('w2')).toBeNull();
    const later = new Date(Date.now() + JOB_LEASE_MS + 1000);
    const again = await jobs.claim('w2', later);
    expect(again).toMatchObject({ lockedBy: 'w2', attempts: 2 });
    // The dead worker can no longer finish it.
    expect(await jobs.complete(claimed!)).toBe(false);
    expect(await jobs.complete(again!)).toBe(true);
  });

  it('the end-of-day cron is registered but idle when jobs are disabled', () => {
    const cron = app.get(SchedulerRegistry).getCronJob('end-of-day');
    expect(cron.isActive).toBe(false);
  });

  describe('end of day', () => {
    const date = addDays(istDate(), -1);
    const doctorId = new Types.ObjectId();
    const leaveDoctorId = new Types.ObjectId();
    const clinicId = new Types.ObjectId();
    let appointments: Model<Appointment>;
    let statuses: Model<DoctorStatusEntity>;
    const ids: Record<string, Types.ObjectId> = {};

    beforeAll(async () => {
      appointments = app.get(getModelToken(Appointment.name));
      statuses = app.get(getModelToken(DoctorStatusEntity.name));
      const base = {
        doctorId,
        clinicId,
        patientUserId: new Types.ObjectId(),
        patientName: 'P',
        patientPhone: '+919876543210',
        date,
        source: 'walk_in',
        statusHistory: [],
      };
      for (const status of [
        'confirmed',
        'checked_in',
        'in_consult',
        'completed',
        'cancelled_by_patient',
      ]) {
        const a = await appointments.create({
          ...base,
          status,
          ...(status !== 'confirmed' && status !== 'cancelled_by_patient'
            ? { visitVerifiedAt: new Date() }
            : {}),
        });
        ids[status] = a._id;
      }
      await statuses.create([
        { doctorId, clinicId, date, state: 'in_clinic' },
        { doctorId: leaveDoctorId, clinicId, date, state: 'on_leave' },
      ]);
    });

    it('closes the day through the queued job, once', async () => {
      await jobs.enqueue(END_OF_DAY_JOB, { date }, { dedupeKey: endOfDayKey(date) });
      await jobs.enqueue(END_OF_DAY_JOB, { date }, { dedupeKey: endOfDayKey(date) });
      expect(await jobs.drain()).toBe(1);
      const by = async (k: string) => (await appointments.findById(ids[k]).lean())!;
      expect((await by('confirmed')).status).toBe('no_show');
      const unlock = istDayRange(date).end.getTime() + 24 * 3600_000;
      for (const k of ['checked_in', 'in_consult']) {
        const a = await by(k);
        expect(a.status).toBe('completed');
        expect(a.reviewUnlockAt!.getTime()).toBe(unlock);
        expect(a.statusHistory.at(-1)).toMatchObject({ status: 'completed', note: 'end of day' });
      }
      expect((await by('completed')).reviewUnlockAt).toBeUndefined();
      expect((await by('cancelled_by_patient')).status).toBe('cancelled_by_patient');
      expect((await statuses.findOne({ doctorId, date }).lean())!.state).toBe('done_for_day');
      expect((await statuses.findOne({ doctorId: leaveDoctorId, date }).lean())!.state).toBe(
        'on_leave',
      );
    });

    it('a rerun changes nothing', async () => {
      const again = await app.get(EndOfDayService).run(date);
      expect(again).toEqual({ noShows: 0, completed: 0, statusesClosed: 0 });
    });
  });
});
