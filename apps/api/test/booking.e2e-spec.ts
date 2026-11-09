import {
  ApiErrorSchema,
  CancelAppointmentResponseSchema,
  ConfirmAppointmentResponseSchema,
  CreateAppointmentResponseSchema,
  MyAppointmentSchema,
  PaymentResultSchema,
  RescheduleAppointmentResponseSchema,
  SlotsResponseSchema,
  pageSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { Appointment } from '../src/appointments/appointment.schema';
import { BookingService } from '../src/appointments/booking.service';
import { Clinic } from '../src/clinics/clinic.schema';
import { addDays, istDate } from '../src/common/time/ist';
import { Doctor } from '../src/doctors/doctor.schema';
import { PAYMENT_PROVIDER } from '../src/integrations';
import { DemoPaymentProvider } from '../src/integrations/payment/demo-payment.provider';
import { Payment } from '../src/payments/payment.schema';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { login, nextIp, type Session } from './helpers';

const API = '/api/v1';
const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:00',
  end: '23:50',
  slotMinutes: 10,
}));
const MyPage = pageSchema(MyAppointmentSchema);

describe('patient booking: slots, hold, pay, confirm, reschedule, cancel (sprint 5)', () => {
  let app: INestApplication;
  let db: Connection;
  let appointments: Model<Appointment>;
  let payments: Model<Payment>;
  let provider: DemoPaymentProvider;
  let booking: BookingService;
  let doctorSession: Session;
  let staff: Session;
  let clinicId: string;
  let doctorId: string;
  const tomorrow = addDays(istDate(), 1);
  const http = () => request(app.getHttpServer());
  const as = (s: Session) => ({ Authorization: s.auth });
  const ip = () => ({ 'X-Forwarded-For': nextIp() });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    appointments = app.get(getModelToken(Appointment.name));
    payments = app.get(getModelToken(Payment.name));
    provider = app.get(PAYMENT_PROVIDER);
    booking = app.get(BookingService);
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
    const user = await db.collection('users').findOne({ phone: SEED.doctors[0].phone });
    doctorId = (await db.collection('doctors').findOne({ userId: user!._id }))!._id.toHexString();
    doctorSession = await login(app, SEED.doctors[0].phone);
    staff = await login(app, SEED.clinics[0].staff.phone);
    // Every day, all day, so the tests do not depend on the weekday or the clock.
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

  const slotsOn = async (s: Session, date: string) =>
    SlotsResponseSchema.parse(
      (
        await http()
          .get(`${API}/doctors/${doctorId}/slots`)
          .query({ clinicId, date })
          .set(as(s))
          .expect(200)
      ).body,
    );

  const hold = (s: Session, slotStart: string, extra: Record<string, unknown> = {}) =>
    http()
      .post(`${API}/appointments`)
      .set(as(s))
      .set(ip())
      .send({
        doctorId,
        clinicId,
        slotStart,
        patientName: 'Asha Devi',
        patientPhone: s.user.phone,
        ...extra,
      });

  /** Books, pays and has the doctor confirm: a visit code exists afterwards. */
  async function confirmedFor(s: Session, offset = 0) {
    const slots = (await slotsOn(s, tomorrow)).slots;
    const created = CreateAppointmentResponseSchema.parse(
      (await hold(s, slots[offset]!.start).expect(201)).body,
    );
    await http()
      .post(`${API}/payments/demo-pay`)
      .set(as(s))
      .send({ appointmentId: created.appointment.id })
      .expect(200);
    await http()
      .post(`${API}/clinic/appointments/${created.appointment.id}/confirm`)
      .set(as(staff))
      .expect(200);
    return { id: created.appointment.id, slot: slots[offset]! };
  }

  describe('slots', () => {
    it('lists free online slots and holds back the walk-in share', async () => {
      const patient = await login(app);
      const r = await slotsOn(patient, tomorrow);
      expect(r.scheduled).toBe(true);
      expect(r.bookingFee).toBe(1500);
      // 143 ten-minute slots, 30% (rounded down) kept for the front desk.
      expect(r.slots).toHaveLength(143 - Math.floor(143 * 0.3));
      const starts = r.slots.map((s) => s.start);
      expect([...starts].sort()).toEqual(starts);
    });

    it('is not scheduled for a day outside the booking window, and asks for sign-in', async () => {
      const patient = await login(app);
      const far = await slotsOn(patient, addDays(istDate(), 30));
      expect(far).toMatchObject({ scheduled: false, slots: [] });
      await http()
        .get(`${API}/doctors/${doctorId}/slots`)
        .query({ clinicId, date: tomorrow })
        .expect(401);
      await http()
        .get(`${API}/doctors/${new Types.ObjectId().toHexString()}/slots`)
        .query({ clinicId, date: tomorrow })
        .set(as(patient))
        .expect(404);
    });
  });

  describe('book and hold', () => {
    it('holds a slot for 10 minutes, hides it from others and refuses a second taker', async () => {
      const a = await login(app);
      const b = await login(app);
      const slot = (await slotsOn(a, tomorrow)).slots[3]!;
      const res = CreateAppointmentResponseSchema.parse(
        (await hold(a, slot.start, { reason: 'checkup' }).expect(201)).body,
      );
      expect(res.appointment).toMatchObject({ status: 'pending_payment', source: 'online' });
      expect(res.order).toMatchObject({ provider: 'demo', amount: 1500, currency: 'INR' });
      const left = Date.parse(res.appointment.holdExpiresAt!) - Date.now();
      expect(left).toBeGreaterThan(9 * 60_000);
      expect(left).toBeLessThanOrEqual(10 * 60_000);

      const lost = await hold(b, slot.start).expect(409);
      expect(code(lost.body)).toBe('SLOT_TAKEN');
      expect((await slotsOn(b, tomorrow)).slots.map((s) => s.start)).not.toContain(slot.start);
    });

    it('rejects a time that is not an online slot, and caps unpaid holds', async () => {
      const p = await login(app);
      const slots = (await slotsOn(p, tomorrow)).slots;
      expect(code((await hold(p, '2026-01-01T04:30:00.000Z').expect(400)).body)).toBe(
        'VALIDATION_FAILED',
      );
      // A real slot time that the schedule keeps for walk-ins is not bookable online.
      const all = new Set(slots.map((s) => s.start));
      const reserved = new Date(`${tomorrow}T00:00:00+05:30`);
      let walkInSlot: string | undefined;
      for (let i = 0; i < 143; i++) {
        const t = new Date(reserved.getTime() + i * 600_000).toISOString();
        if (!all.has(t)) {
          walkInSlot = t;
          break;
        }
      }
      expect(code((await hold(p, walkInSlot!).expect(400)).body)).toBe('VALIDATION_FAILED');

      for (const i of [10, 11, 12]) await hold(p, slots[i]!.start).expect(201);
      expect(code((await hold(p, slots[13]!.start).expect(409)).body)).toBe('CONFLICT');
    });

    it('books for someone else and lists the booking with its doctor and clinic', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (
          await hold(p, slot.start, {
            patientName: 'Meena Devi',
            patientPhone: '+919811100001',
          }).expect(201)
        ).body,
      );
      const mine = MyPage.parse(
        (
          await http()
            .get(`${API}/appointments/mine`)
            .query({ tab: 'upcoming' })
            .set(as(p))
            .expect(200)
        ).body,
      );
      expect(mine.items).toHaveLength(1);
      expect(mine.items[0]).toMatchObject({
        id: made.appointment.id,
        patientName: 'Meena Devi',
        status: 'pending_payment',
        bookingFee: 1500,
        visitCode: null,
        doctor: { id: doctorId },
        clinic: { id: clinicId },
        order: { provider: 'demo', amount: 1500 },
      });
      expect(
        MyPage.parse(
          (
            await http()
              .get(`${API}/appointments/mine`)
              .query({ tab: 'past' })
              .set(as(p))
              .expect(200)
          ).body,
        ).items,
      ).toHaveLength(0);

      // Someone else's booking is a 404, never a 403.
      const other = await login(app);
      await http().get(`${API}/appointments/${made.appointment.id}`).set(as(other)).expect(404);
      await http().get(`${API}/appointments/${made.appointment.id}`).set(as(p)).expect(200);
    });
  });

  describe('pay, doctor confirms, visit code', () => {
    it('moves to waiting for the doctor, then confirmed with a 4-digit code', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const id = made.appointment.id;

      const paid = PaymentResultSchema.parse(
        (
          await http()
            .post(`${API}/payments/demo-pay`)
            .set(as(p))
            .send({ appointmentId: id })
            .expect(200)
        ).body,
      );
      expect(paid.appointment).toMatchObject({
        status: 'pending_confirmation',
        holdExpiresAt: null,
      });
      // Paying twice changes nothing.
      const again = PaymentResultSchema.parse(
        (
          await http()
            .post(`${API}/payments/demo-pay`)
            .set(as(p))
            .send({ appointmentId: id })
            .expect(200)
        ).body,
      );
      expect(again.appointment.status).toBe('pending_confirmation');
      expect(await payments.countDocuments({ appointmentId: new Types.ObjectId(id) })).toBe(1);

      const waiting = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      expect(waiting).toMatchObject({ status: 'pending_confirmation', visitCode: null });

      // A stranger cannot confirm; the clinic's staff can.
      const stranger = await login(app);
      await http().post(`${API}/clinic/appointments/${id}/confirm`).set(as(stranger)).expect(404);
      const confirmed = ConfirmAppointmentResponseSchema.parse(
        (await http().post(`${API}/clinic/appointments/${id}/confirm`).set(as(staff)).expect(200))
          .body,
      );
      expect(confirmed.appointment.status).toBe('confirmed');

      const detail = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      expect(detail.status).toBe('confirmed');
      expect(detail.visitCode).toMatch(/^\d{4}$/);
      // Asking again returns the same code, and confirming twice is harmless.
      await http().post(`${API}/clinic/appointments/${id}/confirm`).set(as(staff)).expect(200);
      const second = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      expect(second.visitCode).toBe(detail.visitCode);

      // The confirmation message exists in the patient's demo inbox, with the code masked.
      const inbox = await http().get(`${API}/me/notifications`).set(as(p)).expect(200);
      const confirmedMsg = (inbox.body.items as { template: string; text: string }[]).find(
        (n) => n.template === 'booking_confirmed',
      );
      expect(confirmedMsg?.text).toContain('••••');
    });

    it('verifies a signed checkout result and ignores a forged one', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const { checkout } = provider.simulatePayment({
        orderId: made.order.orderId,
        amountPaise: made.order.amount,
      });
      const body = {
        appointmentId: made.appointment.id,
        razorpayOrderId: checkout.orderId,
        razorpayPaymentId: checkout.paymentId,
      };
      const bad = await http()
        .post(`${API}/payments/verify`)
        .set(as(p))
        .send({ ...body, razorpaySignature: 'f'.repeat(64) })
        .expect(400);
      expect(code(bad.body)).toBe('VALIDATION_FAILED');
      expect((await booking.byId(p.user.id, made.appointment.id)).status).toBe('pending_payment');

      const ok = PaymentResultSchema.parse(
        (
          await http()
            .post(`${API}/payments/verify`)
            .set(as(p))
            .send({ ...body, razorpaySignature: checkout.signature })
            .expect(200)
        ).body,
      );
      expect(ok.appointment.status).toBe('pending_confirmation');
    });

    it('applies a replayed gateway webhook once', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const { webhook } = provider.simulatePayment({
        orderId: made.order.orderId,
        amountPaise: made.order.amount,
      });
      // The signature covers the raw body, so the replay must be byte for byte the same.
      const raw = () =>
        http()
          .post(`${API}/webhooks/payments`)
          .set('content-type', 'application/json')
          .set('x-doqto-demo-signature', String(webhook.headers['x-doqto-demo-signature']))
          .send(webhook.rawBody.toString());
      await raw().expect(200);
      await raw().expect(200);
      const a = await booking.byId(p.user.id, made.appointment.id);
      expect(a.status).toBe('pending_confirmation');
      expect(
        await payments.countDocuments({ appointmentId: new Types.ObjectId(made.appointment.id) }),
      ).toBe(1);
      // A tampered body is refused.
      await http()
        .post(`${API}/webhooks/payments`)
        .set('content-type', 'application/json')
        .set('x-doqto-demo-signature', String(webhook.headers['x-doqto-demo-signature']))
        .send(webhook.rawBody.toString().replace('"amountPaise":1500', '"amountPaise":1'))
        .expect(401);
    });
  });

  describe('hold expiry and late payment', () => {
    it('frees the slot when the hold runs out, and a late payment revives it if still free', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const id = new Types.ObjectId(made.appointment.id);
      await appointments.updateOne(
        { _id: id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
      );

      // Even before the minute job runs, the list reads it as expired and the slot is free again.
      expect((await booking.byId(p.user.id, made.appointment.id)).status).toBe('expired');
      expect((await slotsOn(p, tomorrow)).slots.map((s) => s.start)).toContain(slot.start);
      expect(await booking.expireHolds()).toBeGreaterThanOrEqual(1);
      expect((await appointments.findById(id))!.status).toBe('expired');

      // Pays late: the slot is still free, so the booking comes back.
      const late = provider.simulatePayment({ orderId: made.order.orderId, amountPaise: 1500 });
      await http()
        .post(`${API}/webhooks/payments`)
        .set('content-type', 'application/json')
        .set('x-doqto-demo-signature', String(late.webhook.headers['x-doqto-demo-signature']))
        .send(late.webhook.rawBody.toString())
        .expect(200);
      expect((await appointments.findById(id))!.status).toBe('pending_confirmation');
    });

    it('refunds a late payment when someone else took the slot', async () => {
      const a = await login(app);
      const b = await login(app);
      const slot = (await slotsOn(a, tomorrow)).slots[0]!;
      const first = CreateAppointmentResponseSchema.parse(
        (await hold(a, slot.start).expect(201)).body,
      );
      await appointments.updateOne(
        { _id: first.appointment.id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
      );
      // b takes the slot (the lapsed hold no longer blocks it).
      await hold(b, slot.start).expect(201);
      const late = provider.simulatePayment({ orderId: first.order.orderId, amountPaise: 1500 });
      await http()
        .post(`${API}/webhooks/payments`)
        .set('content-type', 'application/json')
        .set('x-doqto-demo-signature', String(late.webhook.headers['x-doqto-demo-signature']))
        .send(late.webhook.rawBody.toString())
        .expect(200);
      const paid = await payments.findOne({
        appointmentId: new Types.ObjectId(first.appointment.id),
      });
      expect(paid!.status).toBe('refunded');
      expect((await appointments.findById(first.appointment.id))!.status).toBe('expired');
    });
  });

  describe('reschedule', () => {
    it('moves a confirmed booking back to the doctor for confirmation, and refuses a taken slot', async () => {
      const p = await login(app);
      const { id } = await confirmedFor(p);
      const before = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      const slots = (await slotsOn(p, tomorrow)).slots;
      const target = slots[60]!;
      const moved = RescheduleAppointmentResponseSchema.parse(
        (
          await http()
            .post(`${API}/appointments/${id}/reschedule`)
            .set(as(p))
            .send({ slotStart: target.start })
            .expect(200)
        ).body,
      );
      // The doctor confirmed the old time, not this one: it waits for them again.
      expect(moved.appointment).toMatchObject({ status: 'pending_confirmation', slotStart: target.start });
      const after = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      expect(after.visitCode).toBeNull();
      expect(after.status).toBe('pending_confirmation');
      // Once the doctor accepts the new time the patient has a visit code again.
      await http().post(`${API}/clinic/appointments/${id}/confirm`).set(as(staff)).expect(200);
      const reconfirmed = MyAppointmentSchema.parse(
        (await http().get(`${API}/appointments/${id}`).set(as(p)).expect(200)).body,
      );
      expect(reconfirmed.status).toBe('confirmed');
      expect(reconfirmed.visitCode).toMatch(/^\d{4}$/);
      // The visit code is created again, so the day sheet still knows it was moved.
      const day = await http()
        .get(`${API}/clinic/appointments`)
        .query({ clinicId, doctorId, date: tomorrow })
        .set(as(staff))
        .expect(200);
      expect(JSON.stringify(day.body)).toContain('"rescheduled":true');
      // The old slot is free again.
      expect((await slotsOn(p, tomorrow)).slots.map((s) => s.start)).toContain(before.slotStart);

      // Someone else holds slot 61: moving there loses.
      const other = await login(app);
      await hold(other, slots[61]!.start).expect(201);
      const lost = await http()
        .post(`${API}/appointments/${id}/reschedule`)
        .set(as(p))
        .send({ slotStart: slots[61]!.start })
        .expect(409);
      expect(code(lost.body)).toBe('SLOT_TAKEN');
      // Same time, or someone else's booking: refused / not found.
      await http()
        .post(`${API}/appointments/${id}/reschedule`)
        .set(as(p))
        .send({ slotStart: target.start })
        .expect(409);
      await http()
        .post(`${API}/appointments/${id}/reschedule`)
        .set(as(other))
        .send({ slotStart: slots[62]!.start })
        .expect(404);
    });

    it('refuses to move a visit under 2 hours away or one that is not paid', async () => {
      const p = await login(app);
      const soon = await appointments.create({
        doctorId: new Types.ObjectId(doctorId),
        clinicId: new Types.ObjectId(clinicId),
        patientUserId: new Types.ObjectId(p.user.id),
        patientName: 'Asha Devi',
        patientPhone: p.user.phone,
        date: istDate(),
        slotStart: new Date(Date.now() + 60 * 60_000),
        slotEnd: new Date(Date.now() + 70 * 60_000),
        source: 'online',
        status: 'confirmed',
        bookingFee: 1500,
        statusHistory: [],
      });
      const slot = (await slotsOn(p, tomorrow)).slots[8]!;
      await http()
        .post(`${API}/appointments/${soon.id}/reschedule`)
        .set(as(p))
        .send({ slotStart: slot.start })
        .expect(409);
      const unpaid = CreateAppointmentResponseSchema.parse(
        (await hold(p, (await slotsOn(p, tomorrow)).slots[9]!.start).expect(201)).body,
      );
      await http()
        .post(`${API}/appointments/${unpaid.appointment.id}/reschedule`)
        .set(as(p))
        .send({ slotStart: slot.start })
        .expect(409);
    });
  });

  describe('cancel and refund', () => {
    it('refunds in full while waiting for the doctor, and a second cancel is refused', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const id = made.appointment.id;
      await http()
        .post(`${API}/payments/demo-pay`)
        .set(as(p))
        .send({ appointmentId: id })
        .expect(200);

      const res = CancelAppointmentResponseSchema.parse(
        (
          await http()
            .post(`${API}/appointments/${id}/cancel`)
            .set(as(p))
            .send({ reason: 'change_of_plan' })
            .expect(200)
        ).body,
      );
      expect(res.appointment.status).toBe('cancelled_by_patient');
      expect(res.refund).toEqual({ kind: 'full', amount: 1500 });
      expect((await payments.findOne({ appointmentId: new Types.ObjectId(id) }))!.status).toBe(
        'refunded',
      );
      expect((await slotsOn(p, tomorrow)).slots.map((s) => s.start)).toContain(slot.start);
      await http().post(`${API}/appointments/${id}/cancel`).set(as(p)).send({}).expect(409);

      // It now shows under "past".
      const past = MyPage.parse(
        (await http().get(`${API}/appointments/mine`).query({ tab: 'past' }).set(as(p)).expect(200))
          .body,
      );
      expect(past.items.map((i) => i.id)).toContain(id);
    });

    it('cancels an unpaid hold with nothing to refund and frees the slot', async () => {
      const p = await login(app);
      const slot = (await slotsOn(p, tomorrow)).slots[0]!;
      const made = CreateAppointmentResponseSchema.parse(
        (await hold(p, slot.start).expect(201)).body,
      );
      const res = CancelAppointmentResponseSchema.parse(
        (
          await http()
            .post(`${API}/appointments/${made.appointment.id}/cancel`)
            .set(as(p))
            .send({})
            .expect(200)
        ).body,
      );
      expect(res.refund).toEqual({ kind: 'none', amount: 0 });
      expect((await slotsOn(p, tomorrow)).slots.map((s) => s.start)).toContain(slot.start);
    });

    it('confirmed: full refund 2+ hours ahead, none under 2 hours, and the code stops working', async () => {
      const p = await login(app);
      const far = await confirmedFor(p);
      const farRes = CancelAppointmentResponseSchema.parse(
        (await http().post(`${API}/appointments/${far.id}/cancel`).set(as(p)).send({}).expect(200))
          .body,
      );
      expect(farRes.refund).toEqual({ kind: 'full', amount: 1500 });
      const gone = await appointments.findById(far.id);
      expect(gone!.visitCode).toBeUndefined();
      expect(gone!.visitCodeSealed).toBeUndefined();

      // Under 2 hours: no refund (the booking is inserted directly, as the slot is today).
      const q = await login(app);
      const near = await appointments.create({
        doctorId: new Types.ObjectId(doctorId),
        clinicId: new Types.ObjectId(clinicId),
        patientUserId: new Types.ObjectId(q.user.id),
        patientName: 'Asha Devi',
        patientPhone: q.user.phone,
        date: istDate(),
        slotStart: new Date(Date.now() + 60 * 60_000),
        slotEnd: new Date(Date.now() + 70 * 60_000),
        source: 'online',
        status: 'confirmed',
        bookingFee: 1500,
        statusHistory: [],
      });
      const nearRes = CancelAppointmentResponseSchema.parse(
        (await http().post(`${API}/appointments/${near.id}/cancel`).set(as(q)).send({}).expect(200))
          .body,
      );
      expect(nearRes.refund).toEqual({ kind: 'none', amount: 0 });
    });

    it('does not let another patient cancel it, and checked-in visits cannot be cancelled', async () => {
      const p = await login(app);
      const other = await login(app);
      const { id } = await confirmedFor(p);
      await http().post(`${API}/appointments/${id}/cancel`).set(as(other)).send({}).expect(404);
      await appointments.updateOne({ _id: id }, { $set: { status: 'checked_in' } });
      await http().post(`${API}/appointments/${id}/cancel`).set(as(p)).send({}).expect(409);
    });
  });
});
