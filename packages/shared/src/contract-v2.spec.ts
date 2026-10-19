import {
  CheckInRequestSchema,
  CONTRACT_VERSION,
  CreateClinicAppointmentRequestSchema,
  PutScheduleRequestSchema,
  UpdateStatusRequestSchema,
} from './index';

const id = 'a'.repeat(24);

describe('contract v2', () => {
  it('is version 2', () => expect(CONTRACT_VERSION).toMatch(/^2\./));

  it('schedules: defaults, capacity 1, no overlaps, one exception per date', () => {
    const ok = PutScheduleRequestSchema.parse({
      weekly: [{ day: 1, start: '10:00', end: '13:00', slotMinutes: 10 }],
    });
    expect(ok).toMatchObject({
      bookingWindowDays: 7,
      walkInShare: 0.3,
      isActive: true,
      exceptions: [],
    });
    expect(ok.weekly[0]?.capacityPerSlot).toBe(1);
    const bad = (body: unknown) => PutScheduleRequestSchema.safeParse(body).success;
    expect(
      bad({
        weekly: [{ day: 1, start: '10:00', end: '13:00', slotMinutes: 10, capacityPerSlot: 2 }],
      }),
    ).toBe(false);
    expect(bad({ weekly: [{ day: 1, start: '13:00', end: '10:00', slotMinutes: 10 }] })).toBe(
      false,
    );
    expect(
      bad({
        weekly: [
          { day: 1, start: '10:00', end: '13:00', slotMinutes: 10 },
          { day: 1, start: '12:00', end: '14:00', slotMinutes: 10 },
        ],
      }),
    ).toBe(false);
    expect(
      bad({
        weekly: [],
        exceptions: [
          { date: '2026-10-12', type: 'leave' },
          { date: '2026-10-12', type: 'leave' },
        ],
      }),
    ).toBe(false);
    expect(bad({ weekly: [], exceptions: [{ date: '2026-10-12', type: 'custom' }] })).toBe(false);
    expect(bad({ weekly: [], walkInShare: 1.5 })).toBe(false);
    expect(bad({ weekly: [], extra: 1 })).toBe(false);
  });

  it('manual entries: walk-ins have no slot', () => {
    const base = { clinicId: id, doctorId: id, patientName: 'Ram', patientPhone: '+919876543210' };
    expect(
      CreateClinicAppointmentRequestSchema.safeParse({ ...base, source: 'walk_in' }).success,
    ).toBe(true);
    expect(
      CreateClinicAppointmentRequestSchema.safeParse({ ...base, source: 'online' }).success,
    ).toBe(false);
    expect(
      CreateClinicAppointmentRequestSchema.safeParse({
        ...base,
        source: 'walk_in',
        slotStart: '2026-10-10T05:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('check-in takes a visit code or an OTP', () => {
    expect(
      CheckInRequestSchema.safeParse({ appointmentId: id, method: 'visit_code', code: '1234' })
        .success,
    ).toBe(true);
    expect(
      CheckInRequestSchema.safeParse({ appointmentId: id, method: 'otp', code: '123456' }).success,
    ).toBe(true);
    expect(
      CheckInRequestSchema.safeParse({ appointmentId: id, method: 'otp', code: 'abc' }).success,
    ).toBe(false);
  });

  it('running late needs a delay', () => {
    const base = { clinicId: id, doctorId: id };
    expect(UpdateStatusRequestSchema.safeParse({ ...base, state: 'running_late' }).success).toBe(
      false,
    );
    expect(
      UpdateStatusRequestSchema.safeParse({ ...base, state: 'running_late', delayMinutes: 30 })
        .success,
    ).toBe(true);
    expect(
      UpdateStatusRequestSchema.safeParse({ ...base, state: 'in_clinic', message: 'x'.repeat(81) })
        .success,
    ).toBe(false);
  });
});
