/**
 * Example doctor availability for the booking demo. It follows the API's slot rules (weekly
 * blocks cut into fixed-length slots, in IST) so the real endpoint can replace it later.
 */
import { addDays, todayIst } from './booking';

export interface ScheduleBlock {
  /** 0 is Sunday, as in JavaScript `getDay()`. */
  day: number;
  start: string;
  end: string;
  slotMinutes: number;
}

export interface TimeSlot {
  /** `HH:mm`, 24 hour, IST. */
  time: string;
  available: boolean;
}

export type TimeRange = 'morning' | 'afternoon' | 'evening';

/** How far ahead patients can book (the API default is 7 days, doctors can raise it to 30). */
export const BOOKING_WINDOW_DAYS = 14;
/** A slot starting sooner than this is no longer offered. */
export const LEAD_MINUTES = 15;

const days = (...d: number[]) => d;
const weekly = (on: number[], blocks: Array<[string, string]>, slotMinutes: number) =>
  on.flatMap((day) => blocks.map(([start, end]) => ({ day, start, end, slotMinutes })));

const MON_SAT = days(1, 2, 3, 4, 5, 6);
const MON_FRI = days(1, 2, 3, 4, 5);

/** Keyed by the doctor's slug. */
export const SAMPLE_SCHEDULES: Record<string, ScheduleBlock[]> = {
  'dr-anita-sharma-bareilly': weekly(
    MON_SAT,
    [
      ['09:00', '13:00'],
      ['17:00', '20:00'],
    ],
    15,
  ),
  'dr-sana-qureshi-bareilly': [
    ...weekly(MON_FRI, [['10:00', '14:00']], 20),
    ...weekly([6], [['10:00', '12:00']], 20),
  ],
  'dr-rakesh-sharma-bareilly': weekly(days(2, 4, 6), [['16:00', '20:00']], 20),
  'sample-priya-verma': weekly(days(1, 3, 5), [['11:00', '15:00']], 20),
  'sample-imran-khan': weekly(MON_SAT, [['17:00', '20:00']], 15),
  'sample-vikram-singh': weekly(
    days(1, 2, 4),
    [
      ['09:00', '12:00'],
      ['18:00', '20:00'],
    ],
    30,
  ),
  'sample-neha-gupta': weekly(MON_SAT, [['12:00', '16:00']], 20),
  'sample-arjun-mishra': weekly(
    MON_SAT,
    [
      ['10:00', '14:00'],
      ['16:00', '19:00'],
    ],
    30,
  ),
  'sample-meera-joshi': weekly(MON_SAT, [['08:00', '12:00']], 15),
  'sample-farhan-ali': [
    ...weekly(MON_FRI, [['14:00', '19:00']], 15),
    ...weekly([0], [['10:00', '12:00']], 15),
  ],
};

const FALLBACK: ScheduleBlock[] = weekly(MON_SAT, [['10:00', '13:00']], 15);
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const takenKey = (slug: string, day: string, time: string) => `${slug}|${day}|${time}`;

/** The IST day and `HH:mm` of an instant. */
export function istSlotOf(iso: string): { day: string; time: string } {
  const shifted = new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function rangeOf(time: string): TimeRange {
  const m = minutes(time);
  return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening';
}

/** Weekdays (0 is Sunday) the doctor sees patients. */
export function workingDays(slug: string): number[] {
  const set = new Set((SAMPLE_SCHEDULES[slug] ?? FALLBACK).map((b) => b.day));
  return [...set].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

/**
 * Every slot of the doctor on `day`. A slot is unavailable when it is already taken (by the
 * demo's pretend bookings or the patient's own) or starts within `LEAD_MINUTES` of `now`.
 */
export function slotsOn(
  slug: string,
  day: string,
  now: number,
  taken: ReadonlySet<string> = new Set(),
): TimeSlot[] {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const today = todayIst(now);
  const nowMinutes = Math.floor(((now + 5.5 * 3600_000) % 86_400_000) / 60_000);
  const out: TimeSlot[] = [];
  for (const b of (SAMPLE_SCHEDULES[slug] ?? FALLBACK).filter((x) => x.day === weekday)) {
    for (let m = minutes(b.start); m + b.slotMinutes <= minutes(b.end); m += b.slotMinutes) {
      const time = hhmm(m);
      const past = day < today || (day === today && m < nowMinutes + LEAD_MINUTES);
      const busy = hash(`${slug}|${day}|${time}`) % 4 === 0 || taken.has(takenKey(slug, day, time));
      out.push({ time, available: !past && !busy });
    }
  }
  return out.sort((a, b) => minutes(a.time) - minutes(b.time));
}

export function firstFree(slots: TimeSlot[]): TimeSlot | undefined {
  return slots.find((s) => s.available);
}

/** Days in the booking window on which the doctor still has a free slot. */
export function availableDays(slug: string, now: number, taken: ReadonlySet<string>): Set<string> {
  const today = todayIst(now);
  const out = new Set<string>();
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    const day = addDays(today, i);
    if (firstFree(slotsOn(slug, day, now, taken))) out.add(day);
  }
  return out;
}

/** The soonest free slot in the booking window. */
export function nextAvailable(
  slug: string,
  now: number,
  taken: ReadonlySet<string>,
): { day: string; time: string } | null {
  const today = todayIst(now);
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    const day = addDays(today, i);
    const slot = firstFree(slotsOn(slug, day, now, taken));
    if (slot) return { day, time: slot.time };
  }
  return null;
}
