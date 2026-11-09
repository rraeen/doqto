import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expireHolds, mockConfig, resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import {
  cancelAppointment,
  confirmAppointmentAsDoctor,
  createAppointment,
  demoPay,
  getSlots,
  listMyAppointments,
  rescheduleAppointment,
} from './appointments';
import { requestOtp, verifyOtp } from './auth';
import { searchDoctors } from './doctors';
import { ApiError } from './errors';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetMockDb();
  // Booking counts are exact: no example finished visits.
  mockConfig.seedPastVisits = false;
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  mockConfig.seedPastVisits = true;
  server.close();
});

const istDate = (offset: number) =>
  new Date(Date.now() + 5.5 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

async function signIn(phone: string) {
  await requestOtp(phone);
  await verifyOtp({ phone, code: '123456' });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return (err as ApiError).code;
}

/** A listed doctor with a clinic, and the first day in the next week that has free slots. */
async function pickSlot() {
  const found = await searchDoctors({ city: 'Bareilly' });
  const doctor = found.items.find((d) => d.primaryClinic);
  if (!doctor?.primaryClinic) throw new Error('mock seed has no bookable doctor in Bareilly');
  for (let offset = 2; offset <= 7; offset++) {
    const date = istDate(offset);
    const res = await getSlots(doctor.id, { clinicId: doctor.primaryClinic.id, date });
    if (res.slots.length > 0) return { doctor, clinicId: doctor.primaryClinic.id, date, res };
  }
  throw new Error('no free slot in the next week');
}

const visitor = { patientName: 'Asha Devi', patientPhone: '+919876543210' } as const;

describe('booking against the contract mocks', { timeout: 30_000 }, () => {
  it('holds a slot, pays, lists the booking and cancels with a full refund', async () => {
    await signIn('+919811100001');
    const { doctor, clinicId, res } = await pickSlot();
    expect(res.scheduled).toBe(true);
    const slot = res.slots[0]!;

    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: slot.start,
      reason: 'checkup',
      ...visitor,
    });
    expect(held.appointment.status).toBe('pending_payment');
    expect(held.appointment.holdExpiresAt).not.toBeNull();
    expect(held.order).toMatchObject({ provider: 'demo', currency: 'INR' });

    // The held slot is gone from the list for everyone.
    const after = await getSlots(doctor.id, { clinicId, date: res.date });
    expect(after.slots.some((s) => s.start === slot.start)).toBe(false);

    // Paying does not confirm the visit: it now waits for the doctor, and there is no code yet.
    const paid = await demoPay(held.appointment.id);
    expect(paid.appointment.status).toBe('pending_confirmation');
    expect(paid.appointment.holdExpiresAt).toBeNull();
    const waiting = await listMyAppointments({ tab: 'upcoming' });
    expect(waiting.items[0]).toMatchObject({ status: 'pending_confirmation', visitCode: null });

    // The doctor accepts: the booking is confirmed and the patient gets a 4-digit code.
    const confirmed = await confirmAppointmentAsDoctor(held.appointment.id);
    expect(confirmed.appointment.status).toBe('confirmed');

    const mine = await listMyAppointments({ tab: 'upcoming' });
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({
      id: held.appointment.id,
      status: 'confirmed',
      doctor: { id: doctor.id },
    });
    expect(mine.items[0]?.visitCode).toMatch(/^\d{4}$/);
    expect((await listMyAppointments({ tab: 'past' })).items).toHaveLength(0);

    const cancelled = await cancelAppointment(held.appointment.id, 'change_of_plan');
    expect(cancelled.appointment.status).toBe('cancelled_by_patient');
    expect(cancelled.refund).toEqual({ kind: 'full', amount: mine.items[0]!.bookingFee });
    expect((await listMyAppointments({ tab: 'past' })).items).toHaveLength(1);
    // The slot is free again.
    const freed = await getSlots(doctor.id, { clinicId, date: res.date });
    expect(freed.slots.some((s) => s.start === slot.start)).toBe(true);
  });

  it('refuses a second booking of the same slot with SLOT_TAKEN', async () => {
    await signIn('+919811100002');
    const { doctor, clinicId, res } = await pickSlot();
    const body = { doctorId: doctor.id, clinicId, slotStart: res.slots[0]!.start, ...visitor };
    await createAppointment(body);
    expect(await codeOf(createAppointment(body))).toBe('SLOT_TAKEN');
  });

  it('refuses a slot that does not exist, and bookings when signed out', async () => {
    const { doctor, clinicId, res } = await (async () => {
      await signIn('+919811100003');
      return pickSlot();
    })();
    const off = new Date(Date.parse(res.slots[0]!.start) + 60_000).toISOString();
    expect(
      await codeOf(
        createAppointment({ doctorId: doctor.id, clinicId, slotStart: off, ...visitor }),
      ),
    ).toBe('SLOT_TAKEN');
    expect(await codeOf(demoPay('a'.repeat(24)))).toBe('NOT_FOUND');
  });

  it('lets a hold run out: the booking expires, cannot be paid, and the slot reopens', async () => {
    await signIn('+919811100004');
    const { doctor, clinicId, res } = await pickSlot();
    const slotStart = res.slots[0]!.start;
    const held = await createAppointment({ doctorId: doctor.id, clinicId, slotStart, ...visitor });

    expireHolds(Date.now() + 11 * 60_000);

    expect(await codeOf(demoPay(held.appointment.id))).toBe('CONFLICT');
    const mine = await listMyAppointments();
    expect(mine.items[0]?.status).toBe('expired');
    const again = await getSlots(doctor.id, { clinicId, date: res.date });
    expect(again.slots.some((s) => s.start === slotStart)).toBe(true);
  });

  it('cannot cancel twice, and cancelling before paying charges nothing', async () => {
    await signIn('+919811100005');
    const { doctor, clinicId, res } = await pickSlot();
    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: res.slots[0]!.start,
      ...visitor,
    });
    const first = await cancelAppointment(held.appointment.id);
    expect(first.refund).toEqual({ kind: 'none', amount: 0 });
    expect(await codeOf(cancelAppointment(held.appointment.id))).toBe('CONFLICT');
  });

  it("does not show or cancel another patient's booking", async () => {
    await signIn('+919811100006');
    const { doctor, clinicId, res } = await pickSlot();
    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: res.slots[0]!.start,
      ...visitor,
    });
    await signIn('+919811100007');
    expect((await listMyAppointments()).items).toHaveLength(0);
    expect(await codeOf(cancelAppointment(held.appointment.id))).toBe('NOT_FOUND');
  });

  it('moves a paid booking to another slot while it waits for the doctor', async () => {
    await signIn('+919811100008');
    const { doctor, clinicId, res } = await pickSlot();
    const [first, second] = res.slots;
    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: first!.start,
      ...visitor,
    });
    // An unpaid hold cannot be moved.
    expect(await codeOf(rescheduleAppointment(held.appointment.id, second!.start))).toBe(
      'CONFLICT',
    );
    await demoPay(held.appointment.id);

    const moved = await rescheduleAppointment(held.appointment.id, second!.start);
    // Still waiting for the doctor, now at the new time.
    expect(moved.appointment.status).toBe('pending_confirmation');
    expect(moved.appointment.slotStart).toBe(second!.start);

    const after = await getSlots(doctor.id, { clinicId, date: res.date });
    expect(after.slots.some((s) => s.start === first!.start)).toBe(true); // old slot released
    expect(after.slots.some((s) => s.start === second!.start)).toBe(false); // new slot held
    const mine = await listMyAppointments();
    expect(mine.items[0]?.slotStart).toBe(second!.start);
  });

  it('refuses to move a booking onto a slot someone else holds', async () => {
    await signIn('+919811100009');
    const { doctor, clinicId, res } = await pickSlot();
    const [first, second] = res.slots;
    const mine = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: first!.start,
      ...visitor,
    });
    await demoPay(mine.appointment.id);
    await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: second!.start,
      ...visitor,
    });
    expect(await codeOf(rescheduleAppointment(mine.appointment.id, second!.start))).toBe(
      'SLOT_TAKEN',
    );
  });

  it('refunds in full when cancelling after paying but before the doctor confirms', async () => {
    await signIn('+919811100011');
    const { doctor, clinicId, res } = await pickSlot();
    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: res.slots[0]!.start,
      ...visitor,
    });
    await demoPay(held.appointment.id);
    const cancelled = await cancelAppointment(held.appointment.id);
    expect(cancelled.refund.kind).toBe('full');
    expect(cancelled.refund.amount).toBeGreaterThan(0);
  });

  it('cannot be confirmed by the doctor before payment, or twice', async () => {
    await signIn('+919811100012');
    const { doctor, clinicId, res } = await pickSlot();
    const held = await createAppointment({
      doctorId: doctor.id,
      clinicId,
      slotStart: res.slots[0]!.start,
      ...visitor,
    });
    expect(await codeOf(confirmAppointmentAsDoctor(held.appointment.id))).toBe('CONFLICT');
    await demoPay(held.appointment.id);
    await confirmAppointmentAsDoctor(held.appointment.id);
    expect(await codeOf(confirmAppointmentAsDoctor(held.appointment.id))).toBe('CONFLICT');
    // Paying twice is refused as well.
    expect(await codeOf(demoPay(held.appointment.id))).toBe('CONFLICT');
  });
});
