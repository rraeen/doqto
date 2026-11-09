import { appointmentReference, doctorReference } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import {
  latestBookedFirst,
  sampleAppointments,
  tabOf,
  visibleAppointments,
  type AppointmentCardData,
} from './appointments-view';

describe('tabOf', () => {
  it('keeps active bookings upcoming and everything else past', () => {
    expect(tabOf('confirmed')).toBe('upcoming');
    expect(tabOf('pending_payment')).toBe('upcoming');
    expect(tabOf('completed')).toBe('past');
    expect(tabOf('cancelled_by_clinic')).toBe('past');
    expect(tabOf('no_show')).toBe('past');
  });
});

describe('visibleAppointments', () => {
  const all = sampleAppointments(Date.parse('2026-10-20T08:00:00Z'));

  it('splits upcoming and past, soonest first', () => {
    expect(visibleAppointments(all, 'upcoming', '').map((a) => a.id)).toEqual([
      'sample-1',
      'sample-8',
      'sample-2',
    ]);
    expect(visibleAppointments(all, 'past', '')).toHaveLength(7);
  });

  it('lists past visits most recent first', () => {
    const ids = visibleAppointments(all, 'past', '').map((a) => a.id);
    expect(ids).toEqual([
      'sample-9',
      'sample-10',
      'sample-3',
      'sample-4',
      'sample-5',
      'sample-6',
      'sample-7',
    ]);
  });

  it('searches by the doctor id, the short doctor ID and the appointment ID', () => {
    const anita = all.find((x) => x.id === 'sample-10')!;
    // the doctor's full unique id
    expect(visibleAppointments(all, 'past', anita.doctor.id).map((x) => x.id)).toContain(
      'sample-10',
    );
    // the short doctor ID (DR-...)
    const ref = doctorReference(anita.doctor.id);
    expect(visibleAppointments(all, 'past', ref).map((x) => x.id)).toContain('sample-10');
    expect(visibleAppointments(all, 'past', ref.toLowerCase()).length).toBeGreaterThan(0);
    // the appointment ID (DQ-...)
    expect(
      visibleAppointments(all, 'past', appointmentReference('sample-3')).map((x) => x.id),
    ).toEqual(['sample-3']);
    // an ID that belongs to nobody finds nothing
    expect(visibleAppointments(all, 'past', 'DR-ZZZZZZ')).toEqual([]);
  });

  it('searches by doctor name or specialty, ignoring case', () => {
    expect(visibleAppointments(all, 'past', 'qureshi').map((a) => a.id)).toEqual(['sample-3']);
    expect(visibleAppointments(all, 'past', 'ORTHO').map((a) => a.id)).toEqual(['sample-4']);
    expect(visibleAppointments(all, 'past', 'zzz')).toEqual([]);
  });
});

describe('latestBookedFirst', () => {
  const all = sampleAppointments();
  const a = { ...all[0]!, id: 'older', bookedAt: '2026-10-01T05:00:00.000Z' };
  const b = { ...all[0]!, id: 'newest', bookedAt: '2026-10-19T05:00:00.000Z' };
  const example1 = {
    ...all[0]!,
    id: 'ex1',
    bookedAt: undefined,
    start: '2026-10-22T05:00:00.000Z',
  };
  const example2 = {
    ...all[0]!,
    id: 'ex2',
    bookedAt: undefined,
    start: '2026-10-21T05:00:00.000Z',
  };

  it('puts the booking made most recently first', () => {
    expect(latestBookedFirst([a, b]).map((x) => x.id)).toEqual(['newest', 'older']);
  });

  it('puts real bookings before the example visits, and examples by date', () => {
    expect(latestBookedFirst([example1, a, example2, b]).map((x) => x.id)).toEqual([
      'newest',
      'older',
      'ex2',
      'ex1',
    ]);
  });
});

describe('old saved bookings without a doctor id', () => {
  const old = {
    id: 'demo-1',
    doctor: { name: 'Dr Old Booking', slug: 'dr-old-booking', specialty: 'General Physician' },
    clinic: { name: 'Old Clinic', area: null },
    start: '2026-10-25T05:00:00.000Z',
    status: 'confirmed',
  } as unknown as AppointmentCardData;

  it('can be searched without throwing, by name, slug or an unknown ID', () => {
    expect(visibleAppointments([old], 'upcoming', 'old booking')).toHaveLength(1);
    expect(visibleAppointments([old], 'upcoming', 'dr-old-booking')).toHaveLength(1);
    expect(() => visibleAppointments([old], 'upcoming', 'DR-ABC123')).not.toThrow();
    expect(visibleAppointments([old], 'upcoming', 'DR-ABC123')).toEqual([]);
  });
});
