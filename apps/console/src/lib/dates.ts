/** Today in India, as `YYYY-MM-DD`: the clinic's day, whatever the browser's time zone. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** The date `days` after (or before, if negative) `date`. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A moment as a clock time in India, for example `03:05 pm`; `—` when there is none. */
export function formatTime(iso: string | null): string {
  return iso
    ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso))
    : '—';
}
