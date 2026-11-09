import { describe, expect, it } from 'vitest';
import { istToday, shiftDate } from './dates';

describe('dates in India time', () => {
  it('uses the Indian date, not the browser or UTC one', () => {
    // 20:00 UTC on 9 Nov is already 10 Nov at 01:30 in India.
    expect(istToday(new Date('2026-11-09T20:00:00Z'))).toBe('2026-11-10');
    expect(istToday(new Date('2026-11-09T10:00:00Z'))).toBe('2026-11-09');
  });

  it('moves a date by days across month and year ends', () => {
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDate('2026-02-27', 2)).toBe('2026-03-01');
  });
});
