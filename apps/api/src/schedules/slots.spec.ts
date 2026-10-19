import { addDays, istDate, istDateTime, istDayRange, istWeekday } from '../common/time/ist';
import { expandSlots, firstStart, isLeave } from './slots';

const monday = '2026-10-12';
const schedule = {
  isActive: true,
  weekly: [
    { day: 1, start: '17:00', end: '18:00', slotMinutes: 20 },
    { day: 1, start: '10:00', end: '10:35', slotMinutes: 10 },
  ],
  exceptions: [
    { date: '2026-10-19', type: 'leave' as const },
    {
      date: '2026-10-26',
      type: 'custom' as const,
      blocks: [{ start: '09:00', end: '09:30', slotMinutes: 15 }],
    },
  ],
};

describe('IST time', () => {
  it('converts between instants and IST wall-clock', () => {
    expect(istDateTime('2026-10-12', '10:00').toISOString()).toBe('2026-10-12T04:30:00.000Z');
    expect(istDate(new Date('2026-10-11T18:29:59.999Z'))).toBe('2026-10-11');
    expect(istDate(new Date('2026-10-11T18:30:00.000Z'))).toBe('2026-10-12');
    expect(istDayRange('2026-10-12').start.toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(istWeekday(monday)).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('slots', () => {
  it('expands weekly blocks in time order and drops a short remainder', () => {
    const slots = expandSlots(schedule, monday).map((s) => s.start.toISOString());
    expect(slots).toEqual([
      '2026-10-12T04:30:00.000Z',
      '2026-10-12T04:40:00.000Z',
      '2026-10-12T04:50:00.000Z',
      '2026-10-12T11:30:00.000Z',
      '2026-10-12T11:50:00.000Z',
      '2026-10-12T12:10:00.000Z',
    ]);
    expect(firstStart(schedule, monday)?.toISOString()).toBe('2026-10-12T04:30:00.000Z');
  });

  it('applies leave and custom exceptions, and inactive schedules have no slots', () => {
    expect(expandSlots(schedule, '2026-10-19')).toEqual([]);
    expect(isLeave(schedule, '2026-10-19')).toBe(true);
    expect(expandSlots(schedule, '2026-10-26')).toHaveLength(2);
    expect(expandSlots(schedule, '2026-10-13')).toEqual([]);
    expect(expandSlots({ ...schedule, isActive: false }, monday)).toEqual([]);
    expect(firstStart(schedule, '2026-10-13')).toBeNull();
  });
});
