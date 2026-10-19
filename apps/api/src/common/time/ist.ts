/**
 * IST helpers. India has one zone and no DST, so a fixed +05:30 offset is exact. Clinic days
 * (`YYYY-MM-DD`) and schedule times (`HH:mm`) are IST wall-clock; instants are UTC `Date`s.
 */
export const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** IST calendar date of an instant. */
export function istDate(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant of `HH:mm` IST on `date`. */
export function istDateTime(date: string, time: string): Date {
  return new Date(Date.parse(`${date}T${time}:00.000Z`) - IST_OFFSET_MS);
}

/** Start of `date` in IST (inclusive) and start of the next day (exclusive). */
export function istDayRange(date: string): { start: Date; end: Date } {
  const start = istDateTime(date, '00:00');
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** 0 is Sunday. */
export function istWeekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function minutesOfDay(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
