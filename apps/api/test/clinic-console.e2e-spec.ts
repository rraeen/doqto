import {
  ApiErrorSchema,
  AppointmentPositionSchema,
  DaySheetItemSchema,
  DaySheetResponseSchema,
  DoctorProfileSchema,
  DoctorStatusSchema,
  QueueActionResponseSchema,
  ScheduleSchema,
  SendVisitOtpResponseSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { Appointment } from '../src/appointments/appointment.schema';
import { Clinic } from '../src/clinics/clinic.schema';
import { addDays, istDate, istDateTime } from '../src/common/time/ist';
import { Doctor } from '../src/doctors/doctor.schema';
import { VISIT_CODES, type VisitCodes } from '../src/integrations';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { login, nextPhone, type Session } from './helpers';

const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const API = '/api/v1';
/** Every day, all day, so the tests do not depend on the weekday or the clock. */
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:00',
  end: '23:50',
  slotMinutes: 10,
}));

describe('clinic console: schedules, day sheet, check-in, queue and status (sprint 3)', () => {
  let app: INestApplication;
  let db: Connection;
  let appointments: Model<Appointment>;
  let visitCodes: VisitCodes;
  let doctor: Session;
  let staff: Session;
  let otherStaff: Session;
  let clinicId: string;
  let doctorId: string;
  let doctorSlug: string;
  let otherClinicId: string;
  const http = () => request(app.getHttpServer());
  const as = (s: Session) => ({ Authorization: s.auth });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    appointments = app.get(getModelToken(Appointment.name));
    visitCodes = app.get(VISIT_CODES);
    await seedDemo(
      {
        users: app.get(getModelToken(User.name)),
        doctors: app.get(getModelToken(Doctor.name)),
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      },
      { mode: 'demo' },
    );
    const [c0, , c2] = SEED.clinics;
    const clinic = await db.collection('clinics').findOne({ name: c0.name });
    const other = await db.collection('clinics').findOne({ name: c2.name });
    clinicId = clinic!._id.toHexString();
    otherClinicId = other!._id.toHexString();
    const user = await db.collection('users').findOne({ phone: SEED.doctors[0].phone });
    const d = await db.collection('doctors').findOne({ userId: user!._id });
    doctorId = d!._id.toHexString();
    doctorSlug = String(d!.slug);
    doctor = await login(app, SEED.doctors[0].phone);
    staff = await login(app, c0.staff.phone);
    otherStaff = await login(app, c2.staff.phone);
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  /** A booked (online) appointment for today with a visit code, inserted as BE-27 will. */
  async function bookedToday(slotMinutesFromNow = 0) {
    const _id = new Types.ObjectId();
    const issued = visitCodes.issue(_id.toHexString());
    const slot = new Date(Math.floor(Date.now() / 600_000) * 600_000 + slotMinutesFromNow * 60_000);
    const patient = await login(app);
    await appointments.create({
      _id,
      doctorId: new Types.ObjectId(doctorId),
      clinicId: new Types.ObjectId(clinicId),
      patientUserId: new Types.ObjectId(patient.user.id),
      patientName: 'Booked Patient',
      patientPhone: patient.user.phone,
      date: istDate(),
      slotStart: slot,
      slotEnd: new Date(slot.getTime() + 600_000),
      source: 'online',
      status: 'confirmed',
      visitCode: { hash: issued.hash, attempts: 0 },
      statusHistory: [],
    });
    return { id: _id.toHexString(), code: issued.code, patient };
  }

  async function walkIn(phone = nextPhone()) {
    const res = await http()
      .post(`${API}/clinic/appointments`)
      .set(as(staff))
      .send({ clinicId, doctorId, source: 'walk_in', patientName: 'Walk In', patientPhone: phone })
      .expect(201);
    return DaySheetItemSchema.parse(res.body);
  }

  async function checkInByOtp(id: string) {
    await http().post(`${API}/clinic/queue/${id}/send-otp`).set(as(staff)).expect(200);
    const res = await http()
      .post(`${API}/clinic/queue/check-in`)
      .set(as(staff))
      .send({ appointmentId: id, method: 'otp', code: '123456' })
      .expect(200);
    return QueueActionResponseSchema.parse(res.body);
  }

  describe('BE-14 schedules', () => {
    it('the doctor reads and replaces their schedule; staff read it with doctorId', async () => {
      const seeded = await http()
        .get(`${API}/doctor/schedules/${clinicId}`)
        .set(as(doctor))
        .expect(200);
      expect(ScheduleSchema.parse(seeded.body).weekly).toHaveLength(12);
      const put = await http()
        .put(`${API}/doctor/schedules/${clinicId}`)
        .set(as(doctor))
        .send({ weekly: ALL_WEEK, exceptions: [] })
        .expect(200);
      const saved = ScheduleSchema.parse(put.body);
      expect(saved).toMatchObject({ bookingWindowDays: 7, walkInShare: 0.3, isActive: true });
      expect(saved.weekly).toHaveLength(7);
      const byStaff = await http()
        .get(`${API}/doctor/schedules/${clinicId}?doctorId=${doctorId}`)
        .set(as(staff))
        .expect(200);
      expect(ScheduleSchema.parse(byStaff.body).weekly).toHaveLength(7);
    });

    it('rejects overlapping blocks and unknown fields', async () => {
      const res = await http()
        .put(`${API}/doctor/schedules/${clinicId}`)
        .set(as(doctor))
        .send({
          weekly: [
            { day: 1, start: '10:00', end: '13:00', slotMinutes: 10 },
            { day: 1, start: '12:00', end: '14:00', slotMinutes: 10 },
          ],
          exceptions: [],
        })
        .expect(400);
      expect(code(res.body)).toBe('VALIDATION_FAILED');
      await http()
        .put(`${API}/doctor/schedules/${clinicId}`)
        .set(as(doctor))
        .send({ weekly: ALL_WEEK, exceptions: [], capacity: 4 })
        .expect(400);
    });

    it('staff of another clinic cannot read or write it', async () => {
      await http()
        .get(`${API}/doctor/schedules/${clinicId}?doctorId=${doctorId}`)
        .set(as(otherStaff))
        .expect(403);
      await http()
        .put(`${API}/doctor/schedules/${clinicId}?doctorId=${doctorId}`)
        .set(as(otherStaff))
        .send({ weekly: ALL_WEEK, exceptions: [] })
        .expect(403);
      // A doctor of another clinic is not this clinic's doctor.
      await http()
        .get(`${API}/doctor/schedules/${otherClinicId}?doctorId=${doctorId}`)
        .set(as(otherStaff))
        .expect(404);
    });
  });

  describe('BE-15 day sheet and manual entries', () => {
    it('adds a walk-in for today and lists it on the day sheet', async () => {
      const w = await walkIn();
      expect(w).toMatchObject({
        status: 'confirmed',
        source: 'walk_in',
        slotStart: null,
        hasVisitCode: false,
      });
      const res = await http()
        .get(`${API}/clinic/appointments?clinicId=${clinicId}&doctorId=${doctorId}`)
        .set(as(staff))
        .expect(200);
      const sheet = DaySheetResponseSchema.parse(res.body);
      expect(sheet.date).toBe(istDate());
      expect(sheet.items.map((i) => i.id)).toContain(w.id);
      expect(sheet.status?.state).toBe('not_started');
    });

    it('books a schedule slot by phone and refuses the same slot twice', async () => {
      const date = addDays(istDate(), 2);
      const slotStart = istDateTime(date, '10:30').toISOString();
      const body = {
        clinicId,
        doctorId,
        source: 'phone_manual',
        patientName: 'Ramesh',
        patientPhone: nextPhone(),
        date,
        slotStart,
      };
      const res = await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send(body)
        .expect(201);
      expect(DaySheetItemSchema.parse(res.body)).toMatchObject({ slotStart, date });
      const again = await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send({ ...body, patientPhone: nextPhone() })
        .expect(409);
      expect(code(again.body)).toBe('SLOT_TAKEN');
    });

    it('rejects a time that is not a slot, a walk-in for another day and a far date', async () => {
      const date = addDays(istDate(), 1);
      const base = { clinicId, doctorId, patientName: 'X', patientPhone: nextPhone() };
      await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send({
          ...base,
          source: 'phone_manual',
          date,
          slotStart: istDateTime(date, '10:35').toISOString(),
        })
        .expect(400);
      await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send({ ...base, source: 'walk_in', date })
        .expect(400);
      await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send({ ...base, source: 'whatsapp_manual', date: addDays(istDate(), 31) })
        .expect(400);
    });

    it('another clinic cannot add to or read this day sheet', async () => {
      await http()
        .get(`${API}/clinic/appointments?clinicId=${clinicId}`)
        .set(as(otherStaff))
        .expect(403);
      await http()
        .post(`${API}/clinic/appointments`)
        .set(as(otherStaff))
        .send({
          clinicId,
          doctorId,
          source: 'walk_in',
          patientName: 'X',
          patientPhone: nextPhone(),
        })
        .expect(403);
    });
  });

  describe('BE-16 check-in', () => {
    it('checks in a walk-in with the phone OTP and gives a token', async () => {
      const w = await walkIn();
      const sent = await http()
        .post(`${API}/clinic/queue/${w.id}/send-otp`)
        .set(as(staff))
        .expect(200);
      expect(SendVisitOtpResponseSchema.parse(sent.body).channel).toBe('demo');
      const res = await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: w.id, method: 'otp', code: '123456' })
        .expect(200);
      const r = QueueActionResponseSchema.parse(res.body);
      expect(r.appointment).toMatchObject({ status: 'checked_in', visitVerified: true });
      expect(r.appointment!.queueToken).toBeGreaterThan(0);
      const twice = await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: w.id, method: 'otp', code: '123456' })
        .expect(409);
      expect(code(twice.body)).toBe('CONFLICT');
    });

    it('a wrong OTP is refused', async () => {
      const w = await walkIn();
      await http().post(`${API}/clinic/queue/${w.id}/send-otp`).set(as(staff)).expect(200);
      const res = await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: w.id, method: 'otp', code: '000000' })
        .expect(400);
      expect(code(res.body)).toBe('OTP_INVALID');
    });

    it('checks in a booking with its visit code; an on-time patient keeps the slot as queue time', async () => {
      const b = await bookedToday(5);
      const res = await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: b.id, method: 'visit_code', code: b.code })
        .expect(200);
      const a = QueueActionResponseSchema.parse(res.body).appointment!;
      expect(a.effectiveTime).toBe(a.slotStart);
    });

    it('locks the visit code after 5 wrong tries, even for the demo code', async () => {
      const b = await bookedToday(20);
      const wrong = b.code === '0000' ? '1111' : '0000';
      for (let i = 0; i < 4; i++) {
        const res = await http()
          .post(`${API}/clinic/queue/check-in`)
          .set(as(staff))
          .send({ appointmentId: b.id, method: 'visit_code', code: wrong })
          .expect(400);
        expect(ApiErrorSchema.parse(res.body).error).toMatchObject({
          code: 'OTP_INVALID',
          details: { attemptsLeft: 4 - i },
        });
      }
      const fifth = await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: b.id, method: 'visit_code', code: wrong });
      expect(code(fifth.body)).toBe('OTP_LOCKED');
      for (const c of [b.code, '123456']) {
        const locked = await http()
          .post(`${API}/clinic/queue/check-in`)
          .set(as(staff))
          .send({ appointmentId: b.id, method: 'visit_code', code: c });
        expect(code(locked.body)).toBe('OTP_LOCKED');
      }
      // Once the lock has passed, the right code works again.
      await appointments.updateOne(
        { _id: b.id },
        { $set: { 'visitCode.lockedUntil': new Date(Date.now() - 1000) } },
      );
      await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(staff))
        .send({ appointmentId: b.id, method: 'visit_code', code: b.code })
        .expect(200);
    });

    it('parallel guesses cannot exceed the attempt limit', async () => {
      const b = await bookedToday(30);
      const wrong = b.code === '0000' ? '1111' : '0000';
      await Promise.all(
        Array.from({ length: 10 }, () =>
          http()
            .post(`${API}/clinic/queue/check-in`)
            .set(as(staff))
            .send({ appointmentId: b.id, method: 'visit_code', code: wrong }),
        ),
      );
      const a = await appointments.findById(b.id).lean();
      expect(a!.visitCode!.attempts).toBeLessThanOrEqual(5);
      expect(a!.visitCode!.lockedUntil).toBeDefined();
    });

    it('parallel check-ins never share a token', async () => {
      const ws = await Promise.all(Array.from({ length: 6 }, () => walkIn()));
      const results = await Promise.all(ws.map((w) => checkInByOtp(w.id)));
      const tokens = results.map((r) => r.appointment!.queueToken);
      expect(new Set(tokens).size).toBe(tokens.length);
    });

    it('another clinic sees 404 for this appointment', async () => {
      const w = await walkIn();
      await http().post(`${API}/clinic/queue/${w.id}/send-otp`).set(as(otherStaff)).expect(404);
      await http()
        .post(`${API}/clinic/queue/check-in`)
        .set(as(otherStaff))
        .send({ appointmentId: w.id, method: 'otp', code: '123456' })
        .expect(404);
    });
  });

  describe('BE-17 queue actions and BE-18 position', () => {
    // Fresh doctor at the same clinic so earlier check-ins do not crowd this queue.
    let qDoctorId: string;
    beforeAll(async () => {
      const second = await db.collection('users').findOne({ phone: SEED.doctors[1].phone });
      const d = await db.collection('doctors').findOne({ userId: second!._id });
      qDoctorId = d!._id.toHexString();
    });
    const entry = async (phone = nextPhone()) => {
      const res = await http()
        .post(`${API}/clinic/appointments`)
        .set(as(staff))
        .send({
          clinicId,
          doctorId: qDoctorId,
          source: 'walk_in',
          patientName: 'Q',
          patientPhone: phone,
        })
        .expect(201);
      const id = DaySheetItemSchema.parse(res.body).id;
      return { id, r: await checkInByOtp(id) };
    };
    const next = (currentAppointmentId?: string | null) =>
      http()
        .post(`${API}/clinic/queue/next`)
        .set(as(staff))
        .send({
          clinicId,
          doctorId: qDoctorId,
          ...(currentAppointmentId !== undefined ? { currentAppointmentId } : {}),
        });

    it('calls patients in order, completes the consult and guards double taps', async () => {
      const patientPhone = nextPhone();
      const patient = await login(app, patientPhone);
      const a = await entry();
      const b = await entry();
      const c = await entry(patientPhone);

      const pos = await http()
        .get(`${API}/appointments/${c.id}/position`)
        .set(as(patient))
        .expect(200);
      const p = AppointmentPositionSchema.parse(pos.body);
      expect(p).toMatchObject({ status: 'checked_in', tokensAhead: 2, doctorState: 'not_started' });
      expect(p.estimatedWaitMinutes!.max).toBeGreaterThanOrEqual(p.estimatedWaitMinutes!.min);

      const first = QueueActionResponseSchema.parse((await next(null).expect(200)).body);
      expect(first.appointment).toMatchObject({ id: a.id, status: 'in_consult' });
      expect(first.completed).toBeNull();
      expect(first.status.currentToken).toBe(a.r.appointment!.queueToken);

      // Two phones tap "next" for the same patient: one wins, the other is told to refresh.
      const taps = await Promise.all([next(a.id), next(a.id)]);
      expect(taps.map((t) => t.status).sort()).toEqual([200, 409]);
      const won = QueueActionResponseSchema.parse(taps.find((t) => t.status === 200)!.body);
      expect(won.completed).toMatchObject({ id: a.id, status: 'completed' });
      expect(won.appointment).toMatchObject({ id: b.id, status: 'in_consult' });

      const later = AppointmentPositionSchema.parse(
        (await http().get(`${API}/appointments/${c.id}/position`).set(as(patient)).expect(200))
          .body,
      );
      expect(later.tokensAhead).toBe(1);
      // Anyone else, including another clinic, sees nothing.
      const stranger = await login(app);
      await http().get(`${API}/appointments/${c.id}/position`).set(as(stranger)).expect(404);
      await http().get(`${API}/appointments/${c.id}/position`).set(as(otherStaff)).expect(404);
      // The clinic team can read it.
      await http().get(`${API}/appointments/${c.id}/position`).set(as(staff)).expect(200);

      const done = await appointments.findById(a.id).lean();
      expect(done!.reviewUnlockAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    });

    it('moves a patient ahead and marks a no-show', async () => {
      // Clear the queue first.
      while ((await next().expect(200)).body.appointment) {
        /* drain */
      }
      const a = await entry();
      const b = await entry();
      const moved = await http()
        .post(`${API}/clinic/queue/${b.id}/move`)
        .set(as(staff))
        .send({ beforeAppointmentId: a.id, reason: 'elderly' })
        .expect(200);
      const m = QueueActionResponseSchema.parse(moved.body).appointment!;
      const aDoc = await appointments.findById(a.id).lean();
      expect(new Date(m.effectiveTime!).getTime()).toBeLessThan(aDoc!.effectiveTime!.getTime());
      const called = QueueActionResponseSchema.parse((await next().expect(200)).body);
      expect(called.appointment!.id).toBe(b.id);

      const ns = await http()
        .post(`${API}/clinic/queue/${a.id}/no-show`)
        .set(as(staff))
        .expect(200);
      expect(QueueActionResponseSchema.parse(ns.body).appointment!.status).toBe('no_show');
      await http().post(`${API}/clinic/queue/${a.id}/no-show`).set(as(staff)).expect(409);
    });
  });

  describe('BE-18 status', () => {
    it('staff set running late; the public status shows it, cached and patient-free', async () => {
      const res = await http()
        .put(`${API}/clinic/status`)
        .set(as(staff))
        .send({
          clinicId,
          doctorId,
          state: 'running_late',
          delayMinutes: 20,
          message: 'Stuck in traffic',
        })
        .expect(200);
      const s = DoctorStatusSchema.parse(res.body);
      expect(s).toMatchObject({
        state: 'running_late',
        delayMinutes: 20,
        message: 'Stuck in traffic',
      });
      expect(s.etaAt).not.toBeNull();

      const pub = await http().get(`${API}/doctors/${doctorId}/status`).expect(200);
      expect(pub.headers['cache-control']).toContain('s-maxage=15');
      expect(DoctorStatusSchema.strict().parse(pub.body).state).toBe('running_late');
      expect(JSON.stringify(pub.body)).not.toMatch(/patient|phone/i);

      const profile = await http().get(`${API}/doctors/${doctorSlug}`).expect(200);
      expect(DoctorProfileSchema.parse(profile.body).todayStatus?.state).toBe('running_late');
    });

    it('needs a delay for running late and team access', async () => {
      await http()
        .put(`${API}/clinic/status`)
        .set(as(staff))
        .send({ clinicId, doctorId, state: 'running_late' })
        .expect(400);
      await http()
        .put(`${API}/clinic/status`)
        .set(as(otherStaff))
        .send({ clinicId, doctorId, state: 'in_clinic' })
        .expect(403);
    });

    it('unknown or unlisted doctors have no public status', async () => {
      await http().get(`${API}/doctors/${new Types.ObjectId().toHexString()}/status`).expect(404);
      await http().get(`${API}/doctors/not-an-id/status`).expect(404);
    });
  });
});
