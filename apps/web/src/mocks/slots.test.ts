import { describe, expect, it } from 'vitest';
import { computeSlots, isBookableDate } from './slots';

// Tuesday 20 Oct 2026, 08:00 IST.
const NOW = Date.parse('2026-10-20T08:00:00+05:30');
const times = (date: string, now = NOW, held: string[] = []) =>
  computeSlots(date, now, new Set(held)).map((s) =>
    new Date(Date.parse(s.start) + 5.5 * 3_600_000).toISOString().slice(11, 16),
  );

describe('mock slot rules', () => {
  it('offers 15-minute slots in a morning and an evening block', () => {
    const t = times('2026-10-21');
    expect(t[0]).toBe('10:00');
    expect(t).toContain('12:45');
    expect(t).not.toContain('13:00');
    expect(t).toContain('17:00');
    expect(t.at(-1)).toBe('19:45');
    expect(t).toHaveLength(12 + 12);
  });

  it('has no Sundays and nothing past the booking window or in the past', () => {
    expect(isBookableDate('2026-10-25', NOW)).toBe(false); // Sunday
    expect(isBookableDate('2026-10-19', NOW)).toBe(false); // yesterday
    expect(isBookableDate('2026-10-27', NOW)).toBe(true); // 7 days ahead
    expect(isBookableDate('2026-10-28', NOW)).toBe(false); // 8 days ahead
    expect(times('2026-10-25')).toEqual([]);
  });

  it('drops slots that start within 30 minutes of now, and slots already held', () => {
    // 10:20 IST today: slots must start at least 30 minutes from now (10:50), so 10:45 is out and 11:00 is first.
    const late = Date.parse('2026-10-20T10:20:00+05:30');
    expect(times('2026-10-20', late)[0]).toBe('11:00');
    const held = new Date(Date.parse('2026-10-21T10:00:00+05:30')).toISOString();
    expect(times('2026-10-21', NOW, [held])[0]).toBe('10:15');
  });
});
