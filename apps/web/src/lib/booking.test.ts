import { describe, expect, it } from 'vitest';
import { addDays, monthGrid, slotIso, todayIst } from './booking';

describe('monthGrid', () => {
  it('starts on a Monday and pads with neighbouring months', () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(weeks[0]?.[3]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(weeks[4]?.[6]).toEqual({ date: '2026-11-01', inMonth: false });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('uses six rows when the month needs them', () => {
    expect(monthGrid(2026, 7)).toHaveLength(6); // August 2026 starts on a Saturday
  });
});

describe('days', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('knows today in IST', () => {
    expect(todayIst(Date.parse('2026-10-19T20:00:00Z'))).toBe('2026-10-20');
  });
});

describe('slotIso', () => {
  it('converts an IST day and time to the right instant', () => {
    expect(slotIso('2026-10-21', '10:30')).toBe('2026-10-21T05:00:00.000Z');
  });
});
