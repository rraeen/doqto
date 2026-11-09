'use client';

import { REPORT_REASONS, type TransparencyMonth } from '@doqto/shared';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { REPORT_KEY } from '@/components/reviews/labels';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { accountApi } from '@/lib/api/lazy';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="neu-inset rounded-2xl p-4 text-center">
      <p className="text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold text-ink-muted">{label}</p>
    </div>
  );
}

function MonthCard({ m, label }: { m: TransparencyMonth; label: string }) {
  const { t } = useI18n();
  const removed = REPORT_REASONS.filter((r) => (m.reviewsRemoved[r] ?? 0) > 0);
  return (
    <article className="neu-card space-y-5 rounded-3xl p-5 sm:p-7">
      <h2 className="text-xl font-bold text-ink">{label}</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('transparency.submitted')} value={m.reviewsSubmitted} />
        <Stat label={t('transparency.published')} value={m.reviewsPublished} />
        <Stat label={t('transparency.held')} value={m.reviewsHeld} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-ink">{t('transparency.removed')}</h3>
        {removed.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('transparency.noneRemoved')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {removed.map((r) => (
              <li key={r} className="flex justify-between gap-3">
                <span className="text-ink-muted">{t(REPORT_KEY[r])}</span>
                <span className="font-bold tabular-nums text-ink">{m.reviewsRemoved[r]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <h3 className="font-bold text-ink">{t('transparency.appealsFiled')}</h3>
          <p className="text-ink-muted">
            {t('transparency.byDoctor')}: <b className="text-ink">{m.appealsFiled.doctor}</b>
          </p>
          <p className="text-ink-muted">
            {t('transparency.byPatient')}: <b className="text-ink">{m.appealsFiled.patient}</b>
          </p>
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-ink">{t('transparency.appealsUpheld')}</h3>
          <p className="text-ink-muted">
            {t('transparency.byDoctor')}: <b className="text-ink">{m.appealsUpheld.doctor}</b>
          </p>
          <p className="text-ink-muted">
            {t('transparency.byPatient')}: <b className="text-ink">{m.appealsUpheld.patient}</b>
          </p>
        </div>
      </div>
    </article>
  );
}

/** The public review numbers, month by month: proof that reviews are not for sale. */
export function TransparencyView() {
  const { t, locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const q = useQuery({
    queryKey: ['transparency'],
    queryFn: ({ signal }) => accountApi.getTransparency(signal),
    staleTime: 10 * 60_000,
  });
  const monthName = (ym: string) =>
    new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${ym}-01T00:00:00Z`),
    );

  return (
    <div className="space-y-8">
      <header className="space-y-3 text-center">
        <span className="neu-glow mx-auto flex size-16 items-center justify-center rounded-full">
          <ShieldCheck className="size-8" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t('transparency.title')}
        </h1>
        <p className="mx-auto max-w-xl text-ink-muted">{t('transparency.intro')}</p>
      </header>

      {q.isPending ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      ) : q.isError ? (
        <p role="alert" className="neu-card rounded-3xl p-6 text-center text-ink-muted">
          {t('transparency.unavailable')}
        </p>
      ) : (
        <div className="space-y-5">
          {q.data.months.map((m) => (
            <MonthCard key={m.month} m={m} label={monthName(m.month)} />
          ))}
        </div>
      )}
    </div>
  );
}
