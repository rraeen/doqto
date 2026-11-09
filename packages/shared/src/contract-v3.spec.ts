import {
  CONTRACT_VERSION,
  CancelAppointmentRequestSchema,
  CreateAppointmentRequestSchema,
  ENDPOINTS,
  RescheduleAppointmentRequestSchema,
  appointmentReference,
  doctorReference,
  SlotsQuerySchema,
  canReschedule,
  refundForPatientCancel,
} from './index';

const id = 'a'.repeat(24);
const HOUR = 3_600_000;

describe('contract v3 (booking)', () => {
  it('is version 3 or later', () => expect(CONTRACT_VERSION).toMatch(/^[3-9]\./));

  it('exposes the booking endpoints', () => {
    expect(ENDPOINTS.appointments.create).toBe('/appointments');
    expect(ENDPOINTS.appointments.mine).toBe('/appointments/mine');
    expect(ENDPOINTS.appointments.cancel(id)).toBe(`/appointments/${id}/cancel`);
    expect(ENDPOINTS.doctors.slots(id)).toBe(`/doctors/${id}/slots`);
    expect(ENDPOINTS.payments.demoPay).toBe('/payments/demo-pay');
  });

  it('slots query needs a clinic and an IST date', () => {
    expect(SlotsQuerySchema.safeParse({ clinicId: id, date: '2026-10-21' }).success).toBe(true);
    expect(SlotsQuerySchema.safeParse({ clinicId: id, date: '21-10-2026' }).success).toBe(false);
    expect(SlotsQuerySchema.safeParse({ date: '2026-10-21' }).success).toBe(false);
  });

  it('create request: visitor name and phone, reason from a fixed list, nothing extra', () => {
    const base = {
      doctorId: id,
      clinicId: id,
      slotStart: '2026-10-21T04:30:00.000Z',
      patientName: 'Asha Devi',
      patientPhone: '+919876543210',
    };
    expect(CreateAppointmentRequestSchema.safeParse(base).success).toBe(true);
    expect(CreateAppointmentRequestSchema.safeParse({ ...base, reason: 'child' }).success).toBe(
      true,
    );
    const bad = (extra: object) =>
      CreateAppointmentRequestSchema.safeParse({ ...base, ...extra }).success;
    expect(bad({ reason: 'fever and cough' })).toBe(false);
    expect(bad({ patientName: 'A' })).toBe(false);
    expect(bad({ patientPhone: '9876543210' })).toBe(false);
    expect(bad({ notes: 'chest pain' })).toBe(false);
  });

  it('cancel request takes an optional fixed reason', () => {
    expect(CancelAppointmentRequestSchema.safeParse({}).success).toBe(true);
    expect(CancelAppointmentRequestSchema.safeParse({ reason: 'other' }).success).toBe(true);
    expect(CancelAppointmentRequestSchema.safeParse({ reason: 'free text' }).success).toBe(false);
  });
});

describe('refundForPatientCancel (TDD section 8)', () => {
  const now = Date.parse('2026-10-21T04:00:00.000Z');
  const at = (hours: number) => new Date(now + hours * HOUR).toISOString();
  const base = { status: 'confirmed' as const, bookingFee: 1500, now };

  it('refunds in full when cancelling 2 or more hours ahead', () => {
    expect(refundForPatientCancel({ ...base, slotStart: at(2) })).toEqual({
      kind: 'full',
      amount: 1500,
    });
    expect(refundForPatientCancel({ ...base, slotStart: at(30) }).kind).toBe('full');
  });

  it('refunds nothing under 2 hours, or once the slot has passed', () => {
    expect(refundForPatientCancel({ ...base, slotStart: at(1.99) })).toEqual({
      kind: 'none',
      amount: 0,
    });
    expect(refundForPatientCancel({ ...base, slotStart: at(-1) }).kind).toBe('none');
  });

  it('refunds in full when the doctor is 60 or more minutes late', () => {
    expect(
      refundForPatientCancel({ ...base, slotStart: at(0.5), doctorLateMinutes: 60 }).kind,
    ).toBe('full');
    expect(
      refundForPatientCancel({ ...base, slotStart: at(0.5), doctorLateMinutes: 59 }).kind,
    ).toBe('none');
  });

  it('refunds in full while the doctor has not confirmed, even under 2 hours', () => {
    expect(
      refundForPatientCancel({ ...base, status: 'pending_confirmation', slotStart: at(0.5) }),
    ).toEqual({ kind: 'full', amount: 1500 });
  });

  it('refunds nothing when nothing was paid yet', () => {
    expect(
      refundForPatientCancel({ ...base, status: 'pending_payment', slotStart: at(30) }).kind,
    ).toBe('none');
  });

  it('refunds nothing for a booking with no slot', () => {
    expect(refundForPatientCancel({ ...base, slotStart: null }).kind).toBe('none');
  });
});

describe('canReschedule', () => {
  const now = Date.parse('2026-10-21T04:00:00.000Z');
  const at = (hours: number) => new Date(now + hours * HOUR).toISOString();

  it('allows a confirmed booking 2 or more hours before the slot', () => {
    expect(canReschedule({ status: 'confirmed', slotStart: at(2), now })).toBe(true);
    expect(canReschedule({ status: 'confirmed', slotStart: at(48), now })).toBe(true);
  });

  it('allows a paid booking that is waiting for the doctor', () => {
    expect(canReschedule({ status: 'pending_confirmation', slotStart: at(5), now })).toBe(true);
  });

  it('refuses under 2 hours, after the slot, unpaid, finished or slotless bookings', () => {
    expect(canReschedule({ status: 'confirmed', slotStart: at(1.9), now })).toBe(false);
    expect(canReschedule({ status: 'confirmed', slotStart: at(-1), now })).toBe(false);
    expect(canReschedule({ status: 'pending_payment', slotStart: at(48), now })).toBe(false);
    expect(canReschedule({ status: 'completed', slotStart: at(48), now })).toBe(false);
    expect(canReschedule({ status: 'confirmed', slotStart: null, now })).toBe(false);
  });

  it('reschedule request takes only a slot start', () => {
    expect(
      RescheduleAppointmentRequestSchema.safeParse({ slotStart: '2026-10-22T04:30:00.000Z' })
        .success,
    ).toBe(true);
    expect(
      RescheduleAppointmentRequestSchema.safeParse({
        slotStart: '2026-10-22T04:30:00.000Z',
        doctorId: 'a'.repeat(24),
      }).success,
    ).toBe(false);
  });
});

describe('appointmentReference', () => {
  it('is DQ- plus the last 6 letters or digits of the id, in capitals', () => {
    expect(appointmentReference('64f1a2b3c4d5e6f7a8b9c0d1')).toBe('DQ-B9C0D1');
    expect(appointmentReference('sample-1')).toBe('DQ-AMPLE1');
  });
});

describe('doctorReference', () => {
  it('is DR- plus the last 6 letters or digits of the id, in capitals', () => {
    expect(doctorReference('5eed00000000000000000201')).toBe('DR-000201');
    expect(doctorReference('64f1a2b3c4d5e6f7a8b9c0d1')).toBe('DR-B9C0D1');
    expect(doctorReference('sample-d1')).toBe('DR-MPLED1');
  });
  it('differs for two doctors, even with the same name', () => {
    expect(doctorReference('64f1a2b3c4d5e6f7a8b9c0d1')).not.toBe(
      doctorReference('64f1a2b3c4d5e6f7a8b9c0d2'),
    );
  });
});
