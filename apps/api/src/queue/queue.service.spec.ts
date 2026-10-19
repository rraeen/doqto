import { effectiveTime, ON_TIME_GRACE_MS } from './queue.service';

describe('effectiveTime (TDD 6.2)', () => {
  const slot = new Date('2026-10-10T05:00:00.000Z');
  it('keeps the slot for a patient within the grace period, early or on time', () => {
    expect(effectiveTime(slot, new Date(slot.getTime() - 30 * 60_000))).toBe(slot);
    expect(effectiveTime(slot, new Date(slot.getTime() + ON_TIME_GRACE_MS))).toBe(slot);
  });
  it('uses the check-in time when late or without a slot', () => {
    const late = new Date(slot.getTime() + ON_TIME_GRACE_MS + 1);
    expect(effectiveTime(slot, late)).toBe(late);
    expect(effectiveTime(undefined, late)).toBe(late);
  });
});
