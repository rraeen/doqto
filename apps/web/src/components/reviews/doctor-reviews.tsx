'use client';

import {
  RATING_DIMENSIONS,
  REPORT_REASONS,
  type PublicReview,
  type RatingSummary,
  type ReportReason,
} from '@doqto/shared';
import { Flag, MessageSquareQuote, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { env } from '@/lib/env';
import { summarise } from '@/lib/review-summary';
import { useMe } from '@/lib/session';
import { DIMENSION_KEY, REASON_KEY, RECOMMEND_KEY, REPORT_KEY } from './labels';
import { StarsStatic } from './star-rating';
import { useDoctorReviews, useReportReview } from './use-reviews';

/** The five scores as bars, "% would recommend" and the number of verified visits. */
export function RatingBars({ summary }: { summary: RatingSummary }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink">
        <span className="flex items-center gap-1.5 text-brand-700">
          <ThumbsUp className="size-4" aria-hidden />
          {t('reviews.recommendPct', { pct: summary.recommendPct })}
        </span>
        <span className="text-ink-muted">
          {t('reviews.verifiedCount', { count: summary.count })}
        </span>
      </p>
      <ul className="space-y-3">
        {RATING_DIMENSIONS.map((dim) => {
          const value = summary[dim];
          return (
            <li key={dim} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-muted">{t(DIMENSION_KEY[dim])}</span>
                <span className="font-bold tabular-nums text-ink">{value.toFixed(1)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={t(DIMENSION_KEY[dim])}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={value}
                className="neu-inset h-2.5 overflow-hidden rounded-full"
              >
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(value / 5) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReportSheet({ review }: { review: PublicReview }) {
  const { t } = useI18n();
  const me = useMe();
  const report = useReportReview();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);

  const send = () => {
    if (!reason) return;
    report.mutate(
      { id: review.id, reason },
      {
        onSuccess: () => {
          toast.success(t('reviews.reportSent'));
          setOpen(false);
          setReason(null);
        },
        onError: () => toast.error(t('common.somethingWrong')),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t('reviews.reportTitle')}
      description={t('reviews.reportHint')}
      closeLabel={t('common.close')}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
        >
          <Flag className="size-3.5" aria-hidden />
          {t('reviews.report')}
        </button>
      }
    >
      {me.data ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t('reviews.reportTitle')} className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={
                  reason === r
                    ? 'neu-inset flex min-h-12 w-full items-center rounded-2xl border-2 border-brand-500 px-4 text-left font-semibold text-ink'
                    : 'neu-raised flex min-h-12 w-full items-center rounded-2xl px-4 text-left font-semibold text-ink'
                }
              >
                {t(REPORT_KEY[r])}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!reason}
            loading={report.isPending}
            onClick={send}
          >
            {t('reviews.reportSend')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('reviews.reportSignIn')}</p>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
          >
            {t('home.signIn')}
          </Link>
        </div>
      )}
    </Sheet>
  );
}

function ReviewCard({ review, monthLabel }: { review: PublicReview; monthLabel: string }) {
  const { t } = useI18n();
  const overall = Math.round(
    RATING_DIMENSIONS.reduce((n, d) => n + review.ratings[d], 0) / RATING_DIMENSIONS.length,
  );
  return (
    <li className="neu-card space-y-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{review.reviewerName}</p>
          <p className="text-xs text-ink-muted">{monthLabel}</p>
        </div>
        <StarsStatic value={overall} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={review.wouldRecommend === 'yes' ? 'success' : 'info'}>
          {t(RECOMMEND_KEY[review.wouldRecommend])}
        </Badge>
        <Badge tone="brand">{t(REASON_KEY[review.reason])}</Badge>
        {review.earlierVisit && <Badge tone="warning">{t('reviews.earlierVisit')}</Badge>}
      </div>
      {review.text && <p className="whitespace-pre-line break-words text-ink">{review.text}</p>}
      {review.reply && (
        <div className="rounded-xl bg-brand-500/10 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-brand-700">
            <MessageSquareQuote className="size-4" aria-hidden />
            {t('reviews.doctorReply')}
          </p>
          <p className="text-ink">{review.reply.text}</p>
        </div>
      )}
      <ReportSheet review={review} />
    </li>
  );
}

/**
 * Reviews on a doctor's page: the five score bars, "% would recommend", the number of verified
 * visits and the newest reviews first. Under 5 counted reviews it says "New on Doqto" instead of
 * showing scores, and it never shows one overall number for the doctor.
 */
export function DoctorReviews({
  doctor,
  summary,
}: {
  doctor: { id: string; slug: string };
  summary: RatingSummary | null;
}) {
  const { t, locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const list = useDoctorReviews(doctor);
  // The server works the scores out; demo mode has no server, so work them out from the list.
  const shown = summary ?? (env.bookingApi ? null : summarise(list.items));

  const month = useMemo(
    () => (ym: string) =>
      new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${ym}-01T00:00:00Z`),
      ),
    [tag],
  );

  return (
    <section aria-labelledby="reviews-title" className="space-y-4">
      <h2 id="reviews-title" className="text-lg font-bold">
        {t('reviews.sectionTitle')}
      </h2>

      {shown ? (
        <div className="neu-card rounded-2xl p-4 sm:p-5">
          <RatingBars summary={shown} />
        </div>
      ) : (
        <p className="rounded-md bg-canvas px-3 py-3 text-center text-sm text-ink-muted">
          {t('reviews.newOnDoqto')}
        </p>
      )}

      {list.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t('reviews.loadError')}
        </p>
      ) : list.items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('reviews.noReviews')}</p>
      ) : (
        <ul className="space-y-3">
          {list.items.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              monthLabel={t('reviews.visited', { month: month(r.visitMonth) })}
            />
          ))}
        </ul>
      )}

      {list.hasMore && (
        <Button
          type="button"
          variant="outline"
          className="mx-auto"
          loading={list.loadingMore}
          onClick={list.loadMore}
        >
          {t('reviews.loadMore')}
        </Button>
      )}
    </section>
  );
}
