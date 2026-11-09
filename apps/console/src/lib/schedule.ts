import type { PutScheduleRequest, Schedule } from '@doqto/shared';

/** Monday first, as people read a week. `day` is the API's number: 0 is Sunday. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
export type DayNumber = (typeof WEEK)[number];

export const SLOT_CHOICES = [5, 10, 15, 20, 30, 45, 60] as const;
export const SESSIONS_PER_DAY_MAX = 3;
export const WINDOW_DAYS_MAX = 30;

export interface Session {
  start: string;
  end: string;
}
export interface DayState {
  on: boolean;
  sessions: Session[];
  slotMinutes: number;
}
export interface ScheduleState {
  days: Record<DayNumber, DayState>;
  bookingWindowDays: number;
  /** Kept as saved, so editing the weekly hours never wipes leave days or the walk-in share. */
  keep: Pick<Schedule, 'exceptions' | 'walkInShare' | 'isActive'>;
}

const emptyDay = (): DayState => ({ on: false, sessions: [], slotMinutes: 15 });

export function emptyState(): ScheduleState {
  return {
    days: Object.fromEntries(WEEK.map((d) => [d, emptyDay()])) as Record<DayNumber, DayState>,
    bookingWindowDays: 7,
    keep: { exceptions: [], walkInShare: 0.3, isActive: true },
  };
}

/** From what the API stores (a flat list of blocks) to what the screen edits (days with sessions). */
export function fromSchedule(s: Schedule): ScheduleState {
  const state = emptyState();
  for (const b of s.weekly) {
    const day = state.days[b.day as DayNumber];
    day.on = true;
    day.slotMinutes = day.sessions.length === 0 ? b.slotMinutes : day.slotMinutes;
    day.sessions.push({ start: b.start, end: b.end });
  }
  for (const d of WEEK) state.days[d].sessions.sort((a, b) => a.start.localeCompare(b.start));
  state.bookingWindowDays = s.bookingWindowDays;
  state.keep = { exceptions: s.exceptions, walkInShare: s.walkInShare, isActive: s.isActive };
  return state;
}

/** A common starting point to edit: Monday to Saturday, morning and evening. */
export function typicalWeek(from: ScheduleState): ScheduleState {
  const days = { ...from.days };
  for (const d of WEEK) {
    days[d] =
      d === 0
        ? emptyDay()
        : {
            on: true,
            slotMinutes: 15,
            sessions: [
              { start: '10:00', end: '13:00' },
              { start: '17:00', end: '20:00' },
            ],
          };
  }
  return { ...from, days };
}

/** From the screen back to the API's request. A day that is off, or has no sessions, sends nothing. */
export function toRequest(state: ScheduleState): PutScheduleRequest {
  const weekly = WEEK.flatMap((day) => {
    const d = state.days[day];
    return d.on
      ? d.sessions.map((s) => ({
          day,
          start: s.start,
          end: s.end,
          slotMinutes: d.slotMinutes,
          capacityPerSlot: 1 as const,
        }))
      : [];
  });
  return {
    weekly,
    exceptions: state.keep.exceptions,
    bookingWindowDays: state.bookingWindowDays,
    walkInShare: state.keep.walkInShare,
    isActive: state.keep.isActive,
  };
}
