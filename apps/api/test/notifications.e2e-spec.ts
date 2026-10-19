import {
  AdminNotificationSchema,
  ApiErrorSchema,
  DaySheetItemSchema,
  MyNotificationSchema,
  pageSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { Appointment } from '../src/appointments/appointment.schema';
import { Clinic } from '../src/clinics/clinic.schema';
import { istDate } from '../src/common/time/ist';
import { Doctor } from '../src/doctors/doctor.schema';
import {
  ProviderInputError,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
  type SmsProvider,
  type WhatsAppProvider,
} from '../src/integrations';
import { Notification } from '../src/notifications/notification.schema';
import { NotificationSender } from '../src/notifications/notification-sender.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { login, nextPhone, type Session } from './helpers';

const API = '/api/v1';
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:00',
  end: '23:50',
  slotMinutes: 10,
}));

describe('notifications outbox (BE-21) and status alerts (BE-22)', () => {
  let app: INestApplication;
  let db: Connection;
  let rows: Model<Notification>;
  let appointments: Model<Appointment>;
  let outbox: NotificationsService;
  let sender: NotificationSender;
  let whatsapp: WhatsAppProvider;
  let sms: SmsProvider;
  let staff: Session;
  let clinicId: string;
  let doctorIds: string[];
  const http = () => request(app.getHttpServer());
  const as = (s: Session) => ({ Authorization: s.auth });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    rows = app.get(getModelToken(Notification.name));
    appointments = app.get(getModelToken(Appointment.name));
    outbox = app.get(NotificationsService);
    sender = app.get(NotificationSender);
    whatsapp = app.get(WHATSAPP_PROVIDER);
    sms = app.get(SMS_PROVIDER);
    await seedDemo(
      {
        users: app.get(getModelToken(User.name)),
        doctors: app.get(getModelToken(Doctor.name)),
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      },
      { mode: 'demo' },
    );
    const clinic = await db.collection('clinics').findOne({ name: SEED.clinics[0].name });
    clinicId = clinic!._id.toHexString();
    doctorIds = [];
    for (const d of SEED.doctors.slice(0, 2)) {
      const u = await db.collection('users').findOne({ phone: d.phone });
      const doc = await db.collection('doctors').findOne({ userId: u!._id });
      doctorIds.push(doc!._id.toHexString());
      const s = await login(app, d.phone);
      await http()
        .put(`${API}/doctor/schedules/${clinicId}`)
        .set(as(s))
        .send({ weekly: ALL_WEEK, exceptions: [] })
        .expect(200);
    }
    staff = await login(app, SEED.clinics[0].staff.phone);
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });
  afterEach(() => jest.restoreAllMocks());

  const patient = async () => {
    const s = await login(app);
    return { session: s, id: new Types.ObjectId(s.user.id) };
  };
  const late = {
    template: 'doctor_running_late' as const,
    params: () => ['Anita Sharma', '30', 'https://example.test/d/x/live'],
  };

  describe('outbox', () => {
    it('a dedupe key queues once', async () => {
      const p = await patient();
      const a = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:dup' });
      const b = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:dup' });
      expect(a).toMatchObject({ created: true, status: 'queued' });
      expect(b).toMatchObject({ created: false, id: a!.id });
      expect(await rows.countDocuments({ dedupeKey: 'e2e:dup' })).toBe(1);
    });

    it('caps WhatsApp alerts at 4 per patient per day, even in parallel', async () => {
      const p = await patient();
      const results = await Promise.all(
        Array.from({ length: 7 }, (_, i) =>
          outbox.notify({ ...late, userId: p.id, dedupeKey: `e2e:cap:${i}`, alert: true }),
        ),
      );
      expect(results.filter((r) => r!.status === 'queued')).toHaveLength(4);
      expect(results.filter((r) => r!.status === 'skipped')).toHaveLength(3);
      // A repeated key does not use up the cap; non-alerts are not capped.
      const again = await outbox.notify({
        ...late,
        userId: p.id,
        dedupeKey: 'e2e:cap:0',
        alert: true,
      });
      expect(again!.created).toBe(false);
      const plain = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:cap:plain' });
      expect(plain!.status).toBe('queued');
    });

    it('sends due rows once, with secret parameters sealed at rest', async () => {
      const p = await patient();
      const spy = jest.spyOn(whatsapp, 'sendTemplate');
      const r = await outbox.notify({
        userId: p.id,
        template: 'booking_confirmed',
        params: () => [
          'Anita Sharma',
          'Sharma Clinic',
          'Mon, 12 Oct',
          '10:30 am',
          '4821',
          'https://x.test/a',
        ],
        secret: [4],
        dedupeKey: 'e2e:sealed',
      });
      const stored = (await rows.findById(r!.id).lean())!;
      expect(JSON.stringify(stored)).not.toContain('4821');
      expect(stored.sealed).toBeDefined();
      // Two senders at once still send it once.
      await Promise.all([sender.sendDue(), sender.sendDue()]);
      const calls = spy.mock.calls.filter((c) => c[0].to === p.session.user.phone);
      expect(calls).toHaveLength(1);
      expect(calls[0]![0].params[4]).toBe('4821');
      const sent = (await rows.findById(r!.id).lean())!;
      expect(sent).toMatchObject({ status: 'sent', attempts: 1 });
      expect(sent.providerMessageId).toBeDefined();
      expect(sent.sealed).toBeUndefined();
    });

    it('routes opted-out patients to SMS, also when they opt out after queueing', async () => {
      const p = await patient();
      await db.collection('users').updateOne({ _id: p.id }, { $set: { whatsappOptIn: false } });
      const r = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:sms' });
      expect((await rows.findById(r!.id).lean())!.channel).toBe('sms');
      const q = await patient();
      const r2 = await outbox.notify({ ...late, userId: q.id, dedupeKey: 'e2e:sms-later' });
      await db.collection('users').updateOne({ _id: q.id }, { $set: { whatsappOptIn: false } });
      const smsSpy = jest.spyOn(sms, 'send');
      await sender.sendDue();
      expect(smsSpy.mock.calls.map((c) => c[0].to)).toEqual(
        expect.arrayContaining([p.session.user.phone, q.session.user.phone]),
      );
      expect((await rows.findById(r2!.id).lean())!).toMatchObject({
        status: 'sent',
        channel: 'sms',
      });
    });

    it('retries 3 times with backoff, then fails; bad input fails at once', async () => {
      await sender.sendDue(); // clear earlier rows
      const p = await patient();
      jest
        .spyOn(whatsapp, 'sendTemplate')
        .mockRejectedValue(new Error(`BSP down for ${p.session.user.phone}`));
      const r = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:retry' });
      for (let attempt = 1; attempt <= 4; attempt++) {
        await rows.updateOne({ _id: r!.id }, { $set: { sendAfter: new Date() } });
        await sender.sendDue();
        const row = (await rows.findById(r!.id).lean())!;
        expect(row.attempts).toBe(attempt);
        expect(row.status).toBe(attempt < 4 ? 'queued' : 'failed');
        expect(row.lastError).not.toContain(p.session.user.phone.slice(-8));
        if (attempt < 4) expect(row.sendAfter.getTime()).toBeGreaterThan(Date.now() + 20_000);
      }
      jest
        .spyOn(whatsapp, 'sendTemplate')
        .mockRejectedValue(new ProviderInputError('bad template'));
      const bad = await outbox.notify({ ...late, userId: p.id, dedupeKey: 'e2e:bad' });
      await sender.sendDue();
      expect((await rows.findById(bad!.id).lean())!).toMatchObject({
        status: 'failed',
        attempts: 1,
      });
    });

    it('the demo inbox shows the patient their own messages, secrets masked', async () => {
      const p = await patient();
      await outbox.notify({
        userId: p.id,
        template: 'booking_confirmed',
        params: () => [
          'Anita Sharma',
          'Sharma Clinic',
          'Mon, 12 Oct',
          '10:30 am',
          '9999',
          'https://x.test/a',
        ],
        secret: [4],
        dedupeKey: 'e2e:inbox',
      });
      const res = await http().get(`${API}/me/notifications`).set(as(p.session)).expect(200);
      const page = pageSchema(MyNotificationSchema).parse(res.body);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.text).toContain('Dr Anita Sharma');
      expect(page.items[0]!.text).toContain('••••');
      expect(page.items[0]!.text).not.toContain('9999');
      const other = await login(app);
      const none = await http().get(`${API}/me/notifications`).set(as(other)).expect(200);
      expect(none.body.items).toEqual([]);
    });

    it('admins list failed notifications with masked phones; others are refused', async () => {
      const phone = nextPhone('96');
      await login(app, phone);
      await db.collection('users').updateOne({ phone }, { $addToSet: { roles: 'admin' } });
      const admin = await login(app, phone);
      const res = await http()
        .get(`${API}/admin/notifications?status=failed`)
        .set(as(admin))
        .expect(200);
      const page = pageSchema(AdminNotificationSchema).parse(res.body);
      expect(page.items.length).toBeGreaterThanOrEqual(2);
      expect(
        page.items.every((i) => i.status === 'failed' && i.phoneMasked.startsWith('••••')),
      ).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/\+91\d{10}/);
      const forbidden = await http().get(`${API}/admin/notifications`).set(as(staff)).expect(403);
      expect(ApiErrorSchema.parse(forbidden.body).error.code).toBe('FORBIDDEN');
    });
  });

  describe('status alert rules', () => {
    /** An online booking for today with a future slot, as BE-27 will create it. */
    async function online(doctorId: string, minutesAhead: number) {
      const p = await patient();
      const slot = new Date(Math.ceil(Date.now() / 600_000) * 600_000 + minutesAhead * 60_000);
      const a = await appointments.create({
        doctorId: new Types.ObjectId(doctorId),
        clinicId: new Types.ObjectId(clinicId),
        patientUserId: p.id,
        patientName: 'Online',
        patientPhone: p.session.user.phone,
        date: istDate(),
        slotStart: slot,
        slotEnd: new Date(slot.getTime() + 600_000),
        source: 'online',
        status: 'confirmed',
        statusHistory: [],
      });
      return { ...p, appointmentId: a._id };
    }
    const setStatus = (doctorId: string, body: Record<string, unknown>) =>
      http()
        .put(`${API}/clinic/status`)
        .set(as(staff))
        .send({ clinicId, doctorId, ...body })
        .expect(200);
    const lateRows = (userId: Types.ObjectId) =>
      rows.find({ userId, template: 'doctor_running_late' }).lean();

    it('late by 20+ alerts booked patients once per level, again at +15', async () => {
      const doctorId = doctorIds[0]!;
      const a = await online(doctorId, 60);
      const b = await online(doctorId, 70);
      await setStatus(doctorId, { state: 'running_late', delayMinutes: 10 });
      expect(await lateRows(a.id)).toHaveLength(0);
      // Two phones tap at once.
      await Promise.all([
        setStatus(doctorId, { state: 'running_late', delayMinutes: 25 }),
        setStatus(doctorId, { state: 'running_late', delayMinutes: 25 }),
      ]);
      expect(await lateRows(a.id)).toHaveLength(1);
      expect(await lateRows(b.id)).toHaveLength(1);
      await setStatus(doctorId, { state: 'running_late', delayMinutes: 35 });
      expect(await lateRows(a.id)).toHaveLength(1);
      await setStatus(doctorId, { state: 'running_late', delayMinutes: 40 });
      const again = await lateRows(a.id);
      expect(again.map((r) => r.dedupeKey).sort()).toEqual(
        [
          `delay:${a.appointmentId.toHexString()}:25`,
          `delay:${a.appointmentId.toHexString()}:40`,
        ].sort(),
      );
      expect(again[0]!.params[0]).toBe('Anita Sharma');
    });

    it('done early cancels the bookings still to come and tells online patients', async () => {
      const doctorId = doctorIds[0]!;
      const a = await online(doctorId, 90);
      const walkIn = DaySheetItemSchema.parse(
        (
          await http()
            .post(`${API}/clinic/appointments`)
            .set(as(staff))
            .send({
              clinicId,
              doctorId,
              source: 'walk_in',
              patientName: 'W',
              patientPhone: nextPhone(),
            })
            .expect(201)
        ).body,
      );
      await setStatus(doctorId, { state: 'done_for_day' });
      const cancelled = (await appointments.findById(a.appointmentId).lean())!;
      expect(cancelled).toMatchObject({
        status: 'cancelled_by_clinic',
        cancelReason: 'Doctor done for the day',
      });
      const msgs = await rows
        .find({ userId: a.id, template: 'appointment_cancelled_by_clinic' })
        .lean();
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.params[2]).toBe('15');
      // A walk-in has no slot still to come; end of day handles it.
      expect((await appointments.findById(walkIn.id).lean())!.status).toBe('confirmed');
      await setStatus(doctorId, { state: 'done_for_day' });
      expect(
        await rows.countDocuments({ userId: a.id, template: 'appointment_cancelled_by_clinic' }),
      ).toBe(1);
    });

    it('the patient 3 tokens away hears once when the queue moves', async () => {
      const doctorId = doctorIds[1]!;
      const people: { userId: Types.ObjectId; id: string }[] = [];
      for (let i = 0; i < 5; i++) {
        const p = await patient();
        const res = await http()
          .post(`${API}/clinic/appointments`)
          .set(as(staff))
          .send({
            clinicId,
            doctorId,
            source: 'walk_in',
            patientName: `Q${i}`,
            patientPhone: p.session.user.phone,
          })
          .expect(201);
        const id = DaySheetItemSchema.parse(res.body).id;
        await http().post(`${API}/clinic/queue/${id}/send-otp`).set(as(staff)).expect(200);
        await http()
          .post(`${API}/clinic/queue/check-in`)
          .set(as(staff))
          .send({ appointmentId: id, method: 'otp', code: '123456' })
          .expect(200);
        people.push({ userId: p.id, id });
      }
      const next = () =>
        http()
          .post(`${API}/clinic/queue/next`)
          .set(as(staff))
          .send({ clinicId, doctorId })
          .expect(200);
      const turnNear = (userId: Types.ObjectId) =>
        rows.countDocuments({ userId, template: 'turn_near' });
      await next(); // Q0 in consult: Q3 has Q0, Q1, Q2 ahead
      expect(await turnNear(people[3]!.userId)).toBe(1);
      expect(await turnNear(people[4]!.userId)).toBe(0);
      await next(); // Q1 in consult: Q4 is now 3 away
      expect(await turnNear(people[4]!.userId)).toBe(1);
      expect(await turnNear(people[3]!.userId)).toBe(1);
    });
  });
});
