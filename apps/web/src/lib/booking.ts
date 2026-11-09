/** Date and slot helpers for the booking flow. Days are `YYYY-MM-DD` in IST. */

export interface DayCell {
  date: string;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Today in IST as `YYYY-MM-DD`. */
export function todayIst(now = Date.now()): string {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Adds days to a `YYYY-MM-DD` day. */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weeks of a month, Monday first. `month` is 0 to 11. */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const total = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7) * 7;
  const start = dayKey(year, month, 1);
  const weeks: DayCell[][] = [];
  for (let i = 0; i < total; i += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, j) => {
        const date = addDays(start, i + j - offset);
        return { date, inMonth: Number(date.slice(5, 7)) === month + 1 };
      }),
    );
  }
  return weeks;
}

/** ISO instant of a slot, for storing on an appointment. */
export function slotIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00+05:30`).toISOString();
}
