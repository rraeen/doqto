import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppointmentCardData } from './appointments-view';
import { clearOfflineVisits, offlineVisitsFrom, saveOfflineVisits } from './offline-card';

const visit = (over: Partial<AppointmentCardData> & { id: string }): AppointmentCardData => ({
  doctor: {
    id: '5eed00000000000000000201',
    name: 'Dr Anita Sharma',
    slug: 'dr-anita',
    specialty: 'General Physician',
  },
  clinic: { name: 'Sharma Family Clinic', area: 'Civil Lines' },
  start: '2026-10-22T05:00:00.000Z',
  status: 'confirmed',
  ...over,
});

describe('offlineVisitsFrom', () => {
  it('keeps paid visits still to come, soonest first, and skips the rest', () => {
    const list = offlineVisitsFrom([
      visit({ id: 'b'.repeat(24), start: '2026-10-23T05:00:00.000Z', visitCode: '4821' }),
      visit({
        id: 'a'.repeat(24),
        start: '2026-10-22T05:00:00.000Z',
        status: 'pending_confirmation',
      }),
      visit({ id: 'c'.repeat(24), status: 'pending_payment' }),
      visit({ id: 'd'.repeat(24), status: 'completed' }),
      visit({ id: 'e'.repeat(24), status: 'cancelled_by_patient' }),
      visit({ id: 'sample-1' }),
    ]);
    expect(list.map((v) => v.id)).toEqual(['a'.repeat(24), 'b'.repeat(24)]);
  });

  it('carries the appointment ID, the code and the clinic line for the front desk', () => {
    const [v] = offlineVisitsFrom([visit({ id: '64f1a2b3c4d5e6f7a8b9c0d1', visitCode: '4821' })]);
    expect(v).toMatchObject({
      reference: 'DQ-B9C0D1',
      visitCode: '4821',
      doctor: 'Dr Anita Sharma',
      clinic: 'Sharma Family Clinic, Civil Lines',
    });
  });

  it('holds no code until the doctor has confirmed', () => {
    const [v] = offlineVisitsFrom([visit({ id: 'a'.repeat(24), status: 'pending_confirmation' })]);
    expect(v?.visitCode).toBeNull();
  });

  it('keeps at most five visits', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      visit({ id: String(i).repeat(24), start: `2026-10-${20 + i}T05:00:00.000Z` }),
    );
    expect(offlineVisitsFrom(many)).toHaveLength(5);
  });
});

describe('saving and clearing', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('stores the visits and wipes them on clear', () => {
    saveOfflineVisits(offlineVisitsFrom([visit({ id: 'a'.repeat(24), visitCode: '1234' })]));
    expect(window.localStorage.getItem('doqto-offline-visits')).toContain('1234');
    clearOfflineVisits();
    expect(window.localStorage.getItem('doqto-offline-visits')).toBeNull();
  });

  it('does not rewrite storage when nothing changed', () => {
    const visits = offlineVisitsFrom([visit({ id: 'a'.repeat(24) })]);
    let events = 0;
    const count = () => (events += 1);
    window.addEventListener('doqto-offline-visits-changed', count);
    saveOfflineVisits(visits);
    saveOfflineVisits(visits);
    window.removeEventListener('doqto-offline-visits-changed', count);
    expect(events).toBe(1);
  });
});
