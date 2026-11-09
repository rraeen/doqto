'use client';

import { CalendarClock, MapPin } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { useOfflineVisits } from '@/lib/offline-card';

/**
 * On the offline page: the visits saved on this phone, with the appointment ID and the visit code
 * for the front desk, so they can be shown with no network. Renders nothing when none are saved.
 */
export function OfflineVisits() {
  const { t, locale } = useI18n();
  const visits = useOfflineVisits();
  if (visits.length === 0) return null;
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const when = (iso: string) =>
    new Intl.DateTimeFormat(tag, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));

  return (
    <section aria-labelledby="offline-visits" className="w-full max-w-md space-y-3 text-left">
      <h2 id="offline-visits" className="text-center text-lg font-bold text-ink">
        {t('pwa.offlineVisits')}
      </h2>
      <ul className="space-y-3">
        {visits.map((v) => (
          <li key={v.id} className="neu-card space-y-3 rounded-2xl p-4">
            <div>
              <p className="font-bold text-ink">{v.doctor}</p>
              <p className="text-sm text-ink-muted">{v.specialty}</p>
            </div>
            {v.start && (
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {when(v.start)}
              </p>
            )}
            {v.clinic && (
              <p className="flex items-start gap-2 text-sm text-ink-muted">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {v.clinic}
              </p>
            )}
            <div className="neu-inset rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-ink-muted">
                {t('appointments.appointmentId')}:{' '}
                <span className="tabular-nums text-ink">{v.reference}</span>
              </p>
              {v.visitCode ? (
                <p
                  aria-label={`${t('appointments.visitCodeTitle')} ${v.visitCode.split('').join(' ')}`}
                  className="mt-2 flex justify-center gap-2"
                >
                  {v.visitCode.split('').map((d, i) => (
                    <span
                      key={i}
                      className="flex size-11 items-center justify-center rounded-xl bg-surface text-2xl font-bold text-ink shadow-sm"
                    >
                      {d}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">{t('pwa.offlineNoCode')}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
