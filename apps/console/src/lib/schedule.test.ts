import { PutScheduleRequestSchema, type Schedule } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import { emptyState, fromSchedule, toRequest, typicalWeek } from './schedule';

const saved = (over: Partial<Schedule> = {}): Schedule => ({
  doctorId: 'a'.repeat(24),
  clinicId: 'b'.repeat(24),
  weekly: [],
  exceptions: [],
  bookingWindowDays: 7,
  walkInShare: 0.3,
  isActive: true,
  updatedAt: null,
  ...over,
});

describe('schedule editor state', () => {
  it('a week with nothing set sends no hours, and is valid', () => {
    const req = toRequest(emptyState());
    expect(req.weekly).toEqual([]);
    expect(PutScheduleRequestSchema.safeParse(req).success).toBe(true);
  });

  it('the typical week is Monday to Saturday in two sessions and passes the API rules', () => {
    const req = toRequest(typicalWeek(emptyState()));
    expect(req.weekly).toHaveLength(12);
    expect(req.weekly.some((b) => b.day === 0)).toBe(false);
    expect(PutScheduleRequestSchema.safeParse(req).success).toBe(true);
  });

  it('round trips what the API stores, keeping leave days and the walk-in share', () => {
    const s = saved({
      weekly: [
        { day: 1, start: '17:00', end: '20:00', slotMinutes: 20, capacityPerSlot: 1 },
        { day: 1, start: '10:00', end: '13:00', slotMinutes: 20, capacityPerSlot: 1 },
        { day: 0, start: '09:00', end: '11:00', slotMinutes: 10, capacityPerSlot: 1 },
      ],
      exceptions: [{ date: '2026-12-25', type: 'leave' }],
      walkInShare: 0.5,
      bookingWindowDays: 14,
    });
    const state = fromSchedule(s);
    expect(state.days[1].sessions.map((x) => x.start)).toEqual(['10:00', '17:00']);
    expect(state.days[1].slotMinutes).toBe(20);
    expect(state.days[0]).toMatchObject({ on: true, slotMinutes: 10 });
    expect(state.days[2].on).toBe(false);
    const back = toRequest(state);
    expect(back.exceptions).toEqual([{ date: '2026-12-25', type: 'leave' }]);
    expect(back.walkInShare).toBe(0.5);
    expect(back.bookingWindowDays).toBe(14);
    expect(back.weekly).toHaveLength(3);
  });

  it('a day switched off sends nothing even if it still has sessions', () => {
    const state = typicalWeek(emptyState());
    state.days[3].on = false;
    expect(toRequest(state).weekly.some((b) => b.day === 3)).toBe(false);
  });

  it('overlapping sessions are caught by the same rules the API uses', () => {
    const state = emptyState();
    state.days[1] = {
      on: true,
      slotMinutes: 15,
      sessions: [
        { start: '10:00', end: '13:00' },
        { start: '12:00', end: '14:00' },
      ],
    };
    expect(PutScheduleRequestSchema.safeParse(toRequest(state)).success).toBe(false);
  });
});
