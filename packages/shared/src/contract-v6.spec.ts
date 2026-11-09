import {
  CreateRecordFieldsSchema,
  DoctorSearchPageSchema,
  HealthRecordSchema,
  HealthRecordsPageSchema,
  MyAppointmentSchema,
  MyNotificationSchema,
  RecordsQuerySchema,
  UnreadCountSchema,
} from './index';

const id = 'a'.repeat(24);
const now = '2026-10-21T04:30:00.000Z';

describe('contract v6: records, inbox, search total, held-booking order', () => {
  it('a record needs a title, kind, visit type, doctor and an IST date', () => {
    const ok = {
      title: 'Blood test - CBC',
      kind: 'lab',
      visitType: 'OP',
      doctorName: 'Dr Anita Sharma',
      date: '2026-10-01',
    };
    expect(CreateRecordFieldsSchema.parse(ok)).toMatchObject({ facility: '', status: 'completed' });
    expect(CreateRecordFieldsSchema.safeParse({ ...ok, kind: 'astrology' }).success).toBe(false);
    expect(CreateRecordFieldsSchema.safeParse({ ...ok, date: '01-10-2026' }).success).toBe(false);
    expect(CreateRecordFieldsSchema.safeParse({ ...ok, title: 'A' }).success).toBe(false);
    expect(CreateRecordFieldsSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('records are listed with filters, a total and the doctors facet', () => {
    expect(RecordsQuerySchema.safeParse({}).success).toBe(true);
    expect(RecordsQuerySchema.safeParse({ kind: 'lab,discharge', visitType: 'IP' }).success).toBe(
      true,
    );
    expect(RecordsQuerySchema.safeParse({ kind: 'lab,' }).success).toBe(false);
    expect(RecordsQuerySchema.safeParse({ kind: 'astrology' }).success).toBe(false);
    expect(RecordsQuerySchema.safeParse({ doctor: 'Dr A|Dr B' }).success).toBe(true);
    const record = {
      id,
      kind: 'lab',
      visitType: 'OP',
      title: 'CBC',
      doctorName: 'Dr A',
      facility: '',
      date: '2026-10-01',
      status: 'normal',
      appointmentId: null,
      file: { name: 'cbc.pdf', contentType: 'application/pdf', sizeBytes: 10 },
      createdAt: now,
    };
    expect(HealthRecordSchema.safeParse(record).success).toBe(true);
    expect(
      HealthRecordsPageSchema.safeParse({
        items: [record],
        nextCursor: null,
        total: 1,
        doctors: ['Dr A'],
      }).success,
    ).toBe(true);
  });

  it('a notification carries read state and the booking it is about', () => {
    const n = {
      id,
      channel: 'whatsapp',
      template: 'booking_confirmed',
      language: 'en',
      text: 'Your appointment is confirmed',
      status: 'sent',
      createdAt: now,
      sentAt: now,
      read: false,
      appointmentId: id,
    };
    expect(MyNotificationSchema.safeParse(n).success).toBe(true);
    expect(MyNotificationSchema.safeParse({ ...n, read: undefined }).success).toBe(false);
    expect(UnreadCountSchema.safeParse({ count: 3 }).success).toBe(true);
    expect(UnreadCountSchema.safeParse({ count: -1 }).success).toBe(false);
  });

  it('search pages may carry the total, and a held booking may carry its order', () => {
    expect(DoctorSearchPageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
    expect(
      DoctorSearchPageSchema.safeParse({ items: [], nextCursor: null, total: 57 }).success,
    ).toBe(true);
    const appt = {
      id,
      doctorId: id,
      clinicId: id,
      patientName: 'Asha Devi',
      date: '2026-10-22',
      slotStart: now,
      slotEnd: now,
      source: 'online',
      status: 'pending_payment',
      holdExpiresAt: now,
      queueToken: null,
      checkInAt: null,
      visitVerified: false,
      reviewUnlockAt: null,
      createdAt: now,
      doctor: { id, name: 'Dr A', slug: 'dr-a', specialties: [] },
      clinic: { id, name: 'Clinic', area: null },
      bookingFee: 1500,
      visitCode: null,
    };
    expect(MyAppointmentSchema.safeParse(appt).success).toBe(true);
    const order = { provider: 'demo', orderId: 'o1', amount: 1500, currency: 'INR', keyId: null };
    expect(MyAppointmentSchema.safeParse({ ...appt, order }).success).toBe(true);
    expect(MyAppointmentSchema.safeParse({ ...appt, order: null }).success).toBe(true);
  });
});
