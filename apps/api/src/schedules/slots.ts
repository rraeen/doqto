import { istDateTime, istWeekday, minutesOfDay } from '../common/time/ist';

export interface BlockInput {
  start: string;
  end: string;
  slotMinutes: number;
}
export interface ScheduleInput {
  weekly: (BlockInput & { day: number })[];
  exceptions: { date: string; type: 'leave' | 'custom'; blocks?: BlockInput[] }[];
  isActive: boolean;
}
export interface Slot {
  start: Date;
  end: Date;
}

/** Blocks that apply on `date`: the custom exception's, none on leave, else the weekly ones. */
export function blocksFor(schedule: ScheduleInput, date: string): BlockInput[] {
  if (!schedule.isActive) return [];
  const exception = schedule.exceptions.find((e) => e.date === date);
  if (exception) return exception.type === 'leave' ? [] : (exception.blocks ?? []);
  const day = istWeekday(date);
  return schedule.weekly
    .filter((b) => b.day === day)
    .sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start));
}

export function isLeave(schedule: ScheduleInput, date: string): boolean {
  return schedule.exceptions.some((e) => e.date === date && e.type === 'leave');
}

/**
 * Every slot on `date` (TDD 6.1 step 1, before removing held or booked ones). A trailing
 * remainder shorter than one slot is dropped.
 */
export function expandSlots(schedule: ScheduleInput, date: string): Slot[] {
  const slots: Slot[] = [];
  for (const b of blocksFor(schedule, date)) {
    const step = b.slotMinutes * 60_000;
    const end = istDateTime(date, b.end).getTime();
    for (let t = istDateTime(date, b.start).getTime(); t + step <= end; t += step) {
      slots.push({ start: new Date(t), end: new Date(t + step) });
    }
  }
  return slots;
}

/** First scheduled start on `date`, if the doctor works that day. */
export function firstStart(schedule: ScheduleInput, date: string): Date | null {
  const first = blocksFor(schedule, date)[0];
  return first ? istDateTime(date, first.start) : null;
}
