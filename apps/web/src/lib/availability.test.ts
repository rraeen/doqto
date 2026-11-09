import { describe, expect, it } from 'vitest';
import {
  availableDays,
  firstFree,
  istSlotOf,
  nextAvailable,
  rangeOf,
  slotsOn,
  takenKey,
  workingDays,
} from './availability';

// Monday 19 October 2026, 08:30 IST
const NOW = Date.parse('2026-10-19T03:00:00Z');
const ANITA = 'dr-anita-sharma-bareilly';

describe('slotsOn', () => {
  it('cuts the weekly blocks into slots', () => {
    const slots = slotsOn(ANITA, '2026-10-20', NOW); // a Tuesday
    expect(slots).toHaveLength(28); // 09:00-13:00 and 17:00-20:00 in 15 minute slots
    expect(slots[0]?.time).toBe('09:00');
    expect(slots.at(-1)?.time).toBe('19:45');
  });
  it('has nothing on a day off', () => {
    expect(slotsOn(ANITA, '2026-10-25', NOW)).toEqual([]); // a Sunday
  });
  it('never offers slots that already started', () => {
    const afterHours = Date.parse('2026-10-19T14:00:00Z'); // 19:30 IST
    const today = slotsOn(ANITA, '2026-10-19', afterHours);
    expect(today.filter((s) => s.available).every((s) => s.time >= '19:45')).toBe(true);
    expect(slotsOn(ANITA, '2026-10-18', NOW).some((s) => s.available)).toBe(false);
  });
  it('removes slots the patient already took', () => {
    const first = firstFree(slotsOn(ANITA, '2026-10-20', NOW));
    expect(first).toBeDefined();
    const taken = new Set([takenKey(ANITA, '2026-10-20', first!.time)]);
    const after = slotsOn(ANITA, '2026-10-20', NOW, taken).find((s) => s.time === first!.time);
    expect(after?.available).toBe(false);
  });
  it('is stable for the same inputs', () => {
    expect(slotsOn(ANITA, '2026-10-21', NOW)).toEqual(slotsOn(ANITA, '2026-10-21', NOW));
  });
});

describe('availability across days', () => {
  it('lists working days Monday first', () => {
    expect(workingDays(ANITA)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(workingDays('dr-rakesh-sharma-bareilly')).toEqual([2, 4, 6]);
  });
  it('only marks days within the window that have a free slot', () => {
    const days = availableDays(ANITA, NOW, new Set());
    expect(days.has('2026-10-25')).toBe(false); // Sunday
    expect(days.has('2026-10-20')).toBe(true);
    expect(days.has('2026-11-30')).toBe(false); // beyond the window
  });
  it('finds the next free slot', () => {
    const next = nextAvailable(ANITA, NOW, new Set());
    expect(next?.day).toBe('2026-10-19');
    expect((next?.time ?? '') >= '09:00').toBe(true);
  });
  it('returns null when the doctor never works in the window', () => {
    expect(nextAvailable('unknown-closed', NOW, new Set())).not.toBeNull(); // fallback schedule
  });
});

describe('time ranges', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(rangeOf('09:00')).toBe('morning');
    expect(rangeOf('11:45')).toBe('morning');
    expect(rangeOf('12:00')).toBe('afternoon');
    expect(rangeOf('16:59')).toBe('afternoon');
    expect(rangeOf('17:00')).toBe('evening');
  });
  it('reads an instant back as an IST day and time', () => {
    expect(istSlotOf('2026-10-21T05:00:00.000Z')).toEqual({ day: '2026-10-21', time: '10:30' });
  });
});
