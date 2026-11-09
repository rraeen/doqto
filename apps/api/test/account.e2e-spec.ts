import {
  ApiErrorSchema,
  HealthRecordSchema,
  HealthRecordsPageSchema,
  MyDataExportSchema,
  MyNotificationSchema,
  PushSubscriptionResponseSchema,
  RecordFileLinkSchema,
  TransparencyResponseSchema,
  UnreadCountSchema,
  pageSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { Appointment } from '../src/appointments/appointment.schema';
import { Clinic } from '../src/clinics/clinic.schema';
import { addDays, istDate } from '../src/common/time/ist';
import { Doctor } from '../src/doctors/doctor.schema';
import { HealthRecordDoc } from '../src/records/record.schema';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { PDF, PNG, login, nextIp, type Session } from './helpers';

const API = '/api/v1';
const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:00',
  end: '23:50',
  slotMinutes: 10,
}));
const NotificationsPage = pageSchema(MyNotificationSchema);
const sub = (n: number) => ({
  endpoint: `https://push.example.test/send/device-${n}`,
  keys: { p256dh: `p256dh-key-${n}`, auth: `auth-key-${n}` },
});

describe('account: inbox, devices, records, export, deletion, transparency (sprint 7)', () => {
  let app: INestApplication;
  let db: Connection;
  let appointments: Model<Appointment>;
  let records: Model<HealthRecordDoc>;
  let users: Model<User>;
  let doctorSession: Session;
  let staff: Session;
  let clinicId: string;
  let doctorId: string;
  const tomorrow = addDays(istDate(), 1);
  const http = () => request(app.getHttpServer());
  const as = (s: Session) => ({ Authorization: s.auth });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    appointments = app.get(getModelToken(Appointment.name));
    records = app.get(getModelToken(HealthRecordDoc.name));
    users = app.get(getModelToken(User.name));
    await seedDemo(
      {
        users,
        doctors: app.get(getModelToken(Doctor.name)),
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      },
      { mode: 'demo' },
    );
    const clinic = await db.collection('clinics').findOne({ name: SEED.clinics[0].name });
    clinicId = clinic!._id.toHexString();
    const user = await db.collection('users').findOne({ phone: SEED.doctors[0].phone });
    doctorId = (await db.collection('doctors').findOne({ userId: user!._id }))!._id.toHexString();
    doctorSession = await login(app, SEED.doctors[0].phone);
    staff = await login(app, SEED.clinics[0].staff.phone);
    await http()
      .put(`${API}/doctor/schedules/${clinicId}`)
      .set(as(doctorSession))
      .send({ weekly: ALL_WEEK, exceptions: [], bookingWindowDays: 7, walkInShare: 0.3 })
      .expect(200);
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  async function patient(name = 'Asha Devi') {
    const s = await login(app);
    await http().patch(`${API}/me`).set(as(s)).send({ name }).expect(200);
    return s;
  }

  /** Books, pays and has the clinic confirm one slot; returns the appointment id. */
  async function confirmedBooking(s: Session) {
    const slots = (
      await http()
        .get(`${API}/doctors/${doctorId}/slots`)
        .query({ clinicId, date: tomorrow })
        .set(as(s))
        .expect(200)
    ).body.slots as { start: string }[];
    const made = await http()
      .post(`${API}/appointments`)
      .set(as(s))
      .set({ 'X-Forwarded-For': nextIp() })
      .send({
        doctorId,
        clinicId,
        slotStart: slots[0]!.start,
        patientName: 'Asha Devi',
        patientPhone: s.user.phone,
      })
      .expect(201);
    const id = made.body.appointment.id as string;
    await http()
      .post(`${API}/payments/demo-pay`)
      .set(as(s))
      .send({ appointmentId: id })
      .expect(200);
    await http().post(`${API}/clinic/appointments/${id}/confirm`).set(as(staff)).expect(200);
    return id;
  }

  describe('notification inbox', () => {
    it('lists the messages sent to the patient, counts unread and marks them read', async () => {
      const s = await patient();
      await confirmedBooking(s);
      const unread = UnreadCountSchema.parse(
        (await http().get(`${API}/me/notifications/unread-count`).set(as(s)).expect(200)).body,
      );
      expect(unread.count).toBeGreaterThanOrEqual(1);
      const list = NotificationsPage.parse(
        (await http().get(`${API}/me/notifications`).set(as(s)).expect(200)).body,
      );
      const confirmed = list.items.find((n) => n.template === 'booking_confirmed');
      expect(confirmed).toMatchObject({ read: false });
      expect(confirmed!.appointmentId).toMatch(/^[a-f0-9]{24}$/);
      expect(confirmed!.text).toContain('••••');

      await http().post(`${API}/me/notifications/read`).set(as(s)).expect(204);
      expect(
        UnreadCountSchema.parse(
          (await http().get(`${API}/me/notifications/unread-count`).set(as(s)).expect(200)).body,
        ).count,
      ).toBe(0);
      const after = NotificationsPage.parse(
        (await http().get(`${API}/me/notifications`).set(as(s)).expect(200)).body,
      );
      expect(after.items.every((n) => n.read)).toBe(true);
      // Someone else sees nothing of it.
      const other = await patient('Other Person');
      expect(
        NotificationsPage.parse(
          (await http().get(`${API}/me/notifications`).set(as(other)).expect(200)).body,
        ).items,
      ).toHaveLength(0);
      await http().get(`${API}/me/notifications`).expect(401);
    });
  });

  describe('push devices', () => {
    it('registers a device once, caps at five and removes by id', async () => {
      const s = await patient();
      const first = PushSubscriptionResponseSchema.parse(
        (await http().post(`${API}/me/push-subscriptions`).set(as(s)).send(sub(1)).expect(201))
          .body,
      );
      expect(first.count).toBe(1);
      const again = PushSubscriptionResponseSchema.parse(
        (await http().post(`${API}/me/push-subscriptions`).set(as(s)).send(sub(1)).expect(201))
          .body,
      );
      expect(again).toEqual(first);
      for (const n of [2, 3, 4, 5]) {
        await http().post(`${API}/me/push-subscriptions`).set(as(s)).send(sub(n)).expect(201);
      }
      const sixth = await http()
        .post(`${API}/me/push-subscriptions`)
        .set(as(s))
        .send(sub(6))
        .expect(409);
      expect(code(sixth.body)).toBe('CONFLICT');
      await http().delete(`${API}/me/push-subscriptions/${first.id}`).set(as(s)).expect(204);
      const after = PushSubscriptionResponseSchema.parse(
        (await http().post(`${API}/me/push-subscriptions`).set(as(s)).send(sub(6)).expect(201))
          .body,
      );
      expect(after.count).toBe(5);
      await http()
        .post(`${API}/me/push-subscriptions`)
        .set(as(s))
        .send({ endpoint: 'x' })
        .expect(400);
      await http().post(`${API}/me/push-subscriptions`).send(sub(1)).expect(401);
    });
  });

  describe('records', () => {
    const upload = (
      s: Session,
      fields: Record<string, string>,
      file = PDF,
      name = 'cbc.pdf',
      type = 'application/pdf',
    ) => {
      let r = http().post(`${API}/me/records`).set(as(s));
      for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
      return r.attach('file', file, { filename: name, contentType: type });
    };
    const base = {
      title: 'Blood test - CBC',
      kind: 'lab',
      visitType: 'OP',
      doctorName: 'Dr Anita Sharma',
      facility: 'Sharma Family Clinic',
      date: '2026-10-01',
    };

    it('uploads, lists with search and filters, downloads and deletes', async () => {
      const s = await patient();
      const made = HealthRecordSchema.parse((await upload(s, base).expect(201)).body);
      expect(made).toMatchObject({
        kind: 'lab',
        visitType: 'OP',
        status: 'completed',
        file: { name: 'cbc.pdf', contentType: 'application/pdf' },
      });
      await upload(
        s,
        {
          ...base,
          title: 'Chest X-ray',
          kind: 'diagnostics',
          doctorName: 'Dr Vikram Singh',
          facility: 'Heartcare Clinic',
          date: '2026-09-10',
        },
        PNG,
        'xray.png',
        'image/png',
      ).expect(201);
      await upload(s, {
        ...base,
        title: 'Discharge summary',
        kind: 'discharge',
        visitType: 'IP',
        date: '2026-08-02',
      }).expect(201);

      const get = async (query: Record<string, string> = {}) =>
        HealthRecordsPageSchema.parse(
          (await http().get(`${API}/me/records`).query(query).set(as(s)).expect(200)).body,
        );
      const all = await get();
      expect(all.total).toBe(3);
      expect(all.items.map((r) => r.date)).toEqual(['2026-10-01', '2026-09-10', '2026-08-02']);
      expect(all.doctors).toEqual(['Dr Anita Sharma', 'Dr Vikram Singh']);
      expect((await get({ kind: 'lab,discharge' })).total).toBe(2);
      expect((await get({ visitType: 'IP' })).items.map((r) => r.title)).toEqual([
        'Discharge summary',
      ]);
      expect((await get({ doctor: 'dr vikram singh' })).total).toBe(1);
      expect((await get({ from: '2026-09-01', to: '2026-09-30' })).total).toBe(1);
      expect((await get({ q: 'x-ray' })).total).toBe(1);
      expect((await get({ q: 'sharma family' })).total).toBe(2);
      const page = await get({ limit: '2' });
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).not.toBeNull();
      expect((await get({ limit: '2', cursor: page.nextCursor! })).items).toHaveLength(1);
      await http().get(`${API}/me/records`).query({ kind: 'astrology' }).set(as(s)).expect(400);

      const link = RecordFileLinkSchema.parse(
        (await http().get(`${API}/me/records/${made.id}/file`).set(as(s)).expect(200)).body,
      );
      expect(link).toMatchObject({ fileName: 'cbc.pdf', contentType: 'application/pdf' });
      const u = new URL(link.url);
      const file = await http()
        .get(u.pathname + u.search)
        .expect(200);
      expect(
        Buffer.from(file.body as Buffer)
          .subarray(0, 5)
          .toString(),
      ).toBe('%PDF-');
      // The link is signed: a tampered one is refused.
      await http()
        .get(u.pathname + u.search.replace(/sig=./, 'sig=0'))
        .expect(403);

      await http().delete(`${API}/me/records/${made.id}`).set(as(s)).expect(204);
      expect((await get()).total).toBe(2);
      await http().get(`${API}/me/records/${made.id}/file`).set(as(s)).expect(404);
      await http()
        .get(u.pathname + u.search)
        .expect(404);
    });

    it('keeps a record private to its owner and rejects bad uploads', async () => {
      const s = await patient();
      const other = await patient('Other Person');
      const made = HealthRecordSchema.parse((await upload(s, base).expect(201)).body);
      await http().get(`${API}/me/records/${made.id}/file`).set(as(other)).expect(404);
      await http().delete(`${API}/me/records/${made.id}`).set(as(other)).expect(404);
      expect(
        HealthRecordsPageSchema.parse(
          (await http().get(`${API}/me/records`).set(as(other)).expect(200)).body,
        ).total,
      ).toBe(0);
      await http().get(`${API}/me/records`).expect(401);

      // Not a PDF or image, a renamed file, no file, missing and unknown fields.
      await upload(s, base, Buffer.from('just text'), 'a.pdf', 'application/pdf').expect(400);
      await upload(s, base, PDF, 'a.png', 'image/png').expect(400);
      await upload(s, base, Buffer.from('hello'), 'a.txt', 'text/plain').expect(400);
      await http().post(`${API}/me/records`).set(as(s)).field('title', 'No file').expect(400);
      await upload(s, { ...base, kind: 'astrology' }).expect(400);
      await upload(s, { ...base, date: '01-10-2026' }).expect(400);
      await upload(s, { ...base, extra: 'x' }).expect(400);
      // A booking that is not theirs cannot be linked.
      await upload(s, { ...base, appointmentId: new Types.ObjectId().toHexString() }).expect(404);
    });
  });

  describe('export and deletion', () => {
    it('exports everything about the patient, without the visit code', async () => {
      const s = await patient('Meena Kumari');
      const id = await confirmedBooking(s);
      const out = MyDataExportSchema.parse(
        (await http().get(`${API}/me/export`).set(as(s)).expect(200)).body,
      );
      expect(out.profile).toMatchObject({ id: s.user.id, name: 'Meena Kumari' });
      expect(out.appointments.map((a) => a.id)).toContain(id);
      expect(JSON.stringify(out)).not.toContain('visitCode');
      await http().get(`${API}/me/export`).expect(401);
    });

    it('deletes the account: cancels and refunds, removes the person and their records, ends sessions', async () => {
      const s = await patient('Kavita Rao');
      const id = await confirmedBooking(s);
      const rec = HealthRecordSchema.parse(
        (
          await http()
            .post(`${API}/me/records`)
            .set(as(s))
            .field('title', 'Prescription')
            .field('kind', 'prescription')
            .field('visitType', 'OP')
            .field('doctorName', 'Dr Anita Sharma')
            .field('date', '2026-10-01')
            .attach('file', PDF, { filename: 'rx.pdf', contentType: 'application/pdf' })
            .expect(201)
        ).body,
      );
      const link = RecordFileLinkSchema.parse(
        (await http().get(`${API}/me/records/${rec.id}/file`).set(as(s)).expect(200)).body,
      );

      // A wrong confirmation word changes nothing.
      await http()
        .delete(`${API}/me`)
        .set(as(s))
        .set({ 'X-Forwarded-For': nextIp() })
        .send({ confirm: 'yes' })
        .expect(400);
      await http()
        .delete(`${API}/me`)
        .set(as(s))
        .set({ 'X-Forwarded-For': nextIp() })
        .send({})
        .expect(400);
      await http()
        .delete(`${API}/me`)
        .set(as(s))
        .set({ 'X-Forwarded-For': nextIp() })
        .send({ confirm: 'DELETE' })
        .expect(204);

      const gone = await users.findById(s.user.id).lean();
      expect(gone).toMatchObject({ status: 'deleted', whatsappOptIn: false });
      expect(gone!.name).toBeUndefined();
      expect(gone!.phone).not.toBe(s.user.phone);
      expect(gone!.pushSubscriptions).toHaveLength(0);
      const appt = await appointments.findById(id).lean();
      expect(appt).toMatchObject({
        status: 'cancelled_by_patient',
        patientName: 'Deleted patient',
        patientPhone: 'deleted',
      });
      const payment = await db
        .collection('payments')
        .findOne({ appointmentId: new Types.ObjectId(id) });
      expect(payment!.status).toBe('refunded');
      expect(await records.countDocuments({ userId: new Types.ObjectId(s.user.id) })).toBe(0);
      const u = new URL(link.url);
      await http()
        .get(u.pathname + u.search)
        .expect(404);
      expect(
        await db
          .collection('notifications')
          .countDocuments({ userId: new Types.ObjectId(s.user.id) }),
      ).toBe(0);
      // Sessions end: the refresh token no longer works.
      await http()
        .post(`${API}/auth/refresh`)
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: s.refreshToken })
        .expect(401);
      // The same phone can sign up again as a new, empty account.
      const again = await login(app, s.user.phone);
      expect(again.user.id).not.toBe(s.user.id);
      expect(again.user.name).toBeNull();
    });

    it('does not delete a doctor or clinic account from here', async () => {
      const r = await http()
        .delete(`${API}/me`)
        .set(as(doctorSession))
        .set({ 'X-Forwarded-For': '10.9.9.9' })
        .send({ confirm: 'DELETE' })
        .expect(409);
      expect(code(r.body)).toBe('CONFLICT');
    });
  });

  describe('sign out everywhere', () => {
    it('ends every session of the patient', async () => {
      const phone = (await patient()).user.phone;
      const one = await login(app, phone);
      const two = await login(app, phone);
      await http().post(`${API}/auth/logout-all`).expect(401);
      await http().post(`${API}/auth/logout-all`).set(as(one)).expect(204);
      for (const s of [one, two]) {
        await http()
          .post(`${API}/auth/refresh`)
          .set('X-Doqto-Client', 'mobile')
          .send({ refreshToken: s.refreshToken })
          .expect(401);
      }
    });
  });

  describe('transparency', () => {
    it('is public and lists the latest months, newest first', async () => {
      const t = TransparencyResponseSchema.parse(
        (await http().get(`${API}/transparency`).expect(200)).body,
      );
      expect(t.months.length).toBeGreaterThanOrEqual(1);
      expect(t.months[0]!.month).toBe(istDate().slice(0, 7));
    });
  });
});
