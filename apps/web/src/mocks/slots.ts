import { HOLD_MINUTES, type Slot } from '@doqto/shared';

/**
 * Mock slot rules, standing in for the API's slot computation (BE-25): every doctor sees
 * patients Monday to Saturday, 10:00 to 13:00 and 17:00 to 20:00 IST, in 15-minute slots, and
 * bookings open for the next 7 days. The real API reads each doctor's own schedule.
 */
export const MOCK_SLOT_MINUTES = 15;
export const MOCK_BOOKING_WINDOW_DAYS = 7;
const BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [10 * 60, 13 * 60],
  [17 * 60, 20 * 60],
];
/** Slots that start sooner than this from now can no longer be booked. */
const LEAD_MINUTES = 30;
const IST_OFFSET_MS = 5.5 * 3_600_000;

const istDay = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Whether the doctor sees patients on this IST date and it is inside the booking window. */
export function isBookableDate(date: string, now: number): boolean {
  const day = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${istDay(now)}T00:00:00Z`);
  const ahead = Math.round((day - today) / 86_400_000);
  if (ahead < 0 || ahead > MOCK_BOOKING_WINDOW_DAYS) return false;
  return new Date(day).getUTCDay() !== 0; // no Sundays
}

/** Free slots for an IST date, earliest first. `held` holds ISO start times already taken. */
export function computeSlots(date: string, now: number, held: ReadonlySet<string>): Slot[] {
  if (!isBookableDate(date, now)) return [];
  const midnight = Date.parse(`${date}T00:00:00+05:30`);
  const slots: Slot[] = [];
  for (const [from, to] of BLOCKS) {
    for (let m = from; m + MOCK_SLOT_MINUTES <= to; m += MOCK_SLOT_MINUTES) {
      const start = midnight + m * 60_000;
      if (start < now + LEAD_MINUTES * 60_000) continue;
      const startIso = new Date(start).toISOString();
      if (held.has(startIso)) continue;
      slots.push({
        start: startIso,
        end: new Date(start + MOCK_SLOT_MINUTES * 60_000).toISOString(),
      });
    }
  }
  return slots;
}

export const holdExpiry = (now: number) => new Date(now + HOLD_MINUTES * 60_000).toISOString();
