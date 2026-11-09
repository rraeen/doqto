'use client';

import { useI18n } from '@/i18n/provider';

/** Formats a slot time in IST for the current language. */
export function useWhen() {
  const { locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(d);
    const time = new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(d);
    return { date, time };
  };
}

/** Formats a `YYYY-MM-DD` day for the current language. */
export function useDayLabel() {
  const { locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return (day: string | null) =>
    day
      ? new Intl.DateTimeFormat(tag, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        }).format(new Date(`${day}T00:00:00+05:30`))
      : null;
}
