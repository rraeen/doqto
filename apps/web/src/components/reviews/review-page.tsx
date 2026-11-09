'use client';

import {
  RATING_DIMENSIONS,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  REVIEW_WAIT_MAX_MINUTES,
  VISIT_REASONS,
  WOULD_RECOMMEND,
  reviewWindow,
  type RatingDimension,
  type ReviewRatings,
  type VisitReason,
  type WouldRecommend,
} from '@doqto/shared';
import { ArrowLeft, CalendarX2, CheckCircle2, Clock, LogIn, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/use-now';
import { DIMENSION_KEY, REASON_KEY, RECOMMEND_KEY } from './labels';
import { StarRating, StarsStatic } from './star-rating';
import { reviewEditable, useMyReview, useReviewEligibility, useSubmitReview } from './use-reviews';

type Draft = {
  ratings: Partial<ReviewRatings>;
  recommend: WouldRecommend | null;
  reason: VisitReason | null;
  text: string;
  wait: string;
};

const EMPTY: Draft = { ratings: {}, recommend: null, reason: null, text: '', wait: '' };

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full px-5 text-sm font-bold',
        active ? 'neu-inset border-2 border-brand-500 text-ink' : 'neu-raised text-ink',
      )}
    >
      {children}
    </button>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link
      href="/appointments"
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('reviews.back')}
    </Link>
  );
}

export function ReviewPage({ appointmentId }: { appointmentId: string }) {
  const { t, locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const now = useNow();
  const { me, items, isPending } = useReviewEligibility();
  const mine = useMyReview(appointmentId);
  const submit = useSubmitReview();
  const visit = items.find((x) => x.appointmentId === appointmentId);

  // The form starts from the existing review when there is one, so editing shows what was sent.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [done, setDone] = useState<'published' | 'checking' | null>(null);
  const existing = mine.review;
  const base: Draft = useMemo(
    () =>
      existing
        ? {
            ratings: existing.ratings,
            recommend: existing.wouldRecommend,
            reason: existing.reason,
            text: existing.text ?? '',
            wait: existing.waitedMinutes === null ? '' : String(existing.waitedMinutes),
          }
        : EMPTY,
    [existing],
  );
  const d = draft ?? base;
  // Updates build on the latest draft, so several quick taps in a row all count.
  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...(prev ?? base), ...patch }));
  const setRating = (dim: RatingDimension, n: number) =>
    setDraft((prev) => {
      const cur = prev ?? base;
      return { ...cur, ratings: { ...cur.ratings, [dim]: n } };
    });

  if (isPending || mine.isPending) {
    return (
      <div className="space-y-5" aria-busy>
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('reviews.signIn')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/appointments/${appointmentId}/review`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  if (!visit) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t('reviews.notFound')}
        action={
          <Link
            href="/appointments"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('reviews.back')}
          </Link>
        }
      />
    );
  }

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="neu-card space-y-4 rounded-3xl p-8">
          <span className="neu-glow mx-auto flex size-20 items-center justify-center rounded-full">
            <PartyPopper className="size-10" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-ink">{t('reviews.thanksTitle')}</h1>
          <p className="text-ink-muted">
            {done === 'published' ? t('reviews.thanksPublished') : t('reviews.thanksChecking')}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/d/${visit.doctor.id}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-8' })}
          >
            {t('reviews.viewProfile')}
          </Link>
          <Link
            href="/appointments"
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-auto px-8' })}
          >
            {t('reviews.back')}
          </Link>
        </div>
      </div>
    );
  }

  const editable = reviewEditable(existing, now);

  if (!existing && visit.state === 'locked') {
    const hours = Math.max(1, Math.ceil((Date.parse(visit.unlocksAt) - now) / 3_600_000));
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <BackLink />
        <EmptyState
          icon={Clock}
          title={t('reviews.lockedTitle')}
          description={t('reviews.lockedBody', { when: t('reviews.lockedIn', { hours }) })}
        />
      </div>
    );
  }
  if (!existing && visit.state === 'expired') {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <BackLink />
        <EmptyState
          icon={CalendarX2}
          title={t('reviews.expiredTitle')}
          description={t('reviews.expiredBody')}
        />
      </div>
    );
  }

  // A review already sent that can no longer be edited: show it, read-only.
  if (existing && !editable) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <BackLink />
        <section className="neu-card space-y-4 rounded-3xl p-5 sm:p-7">
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
            <CheckCircle2 className="size-6 text-brand-700" aria-hidden />
            {t('reviews.yourReview')}
          </h1>
          {existing.state === 'held_for_review' && (
            <p className="rounded-xl bg-warning-bg px-4 py-2 text-sm font-medium text-warning">
              {t('reviews.beingChecked')}
            </p>
          )}
          <ul className="space-y-2">
            {RATING_DIMENSIONS.map((dim) => (
              <li key={dim} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-muted">{t(DIMENSION_KEY[dim])}</span>
                <StarsStatic value={existing.ratings[dim]} />
              </li>
            ))}
          </ul>
          {existing.text && <p className="text-ink">{existing.text}</p>}
        </section>
      </div>
    );
  }

  const ratings = d.ratings;
  const allRated = RATING_DIMENSIONS.every((dim) => ratings[dim]);
  const trimmed = d.text.trim();
  const textOk = trimmed.length === 0 || trimmed.length >= REVIEW_TEXT_MIN;
  const waitNum = d.wait.trim() === '' ? undefined : Number(d.wait);
  const waitOk =
    waitNum === undefined ||
    (Number.isInteger(waitNum) && waitNum >= 0 && waitNum <= REVIEW_WAIT_MAX_MINUTES);
  const ready = allRated && d.recommend && d.reason && textOk && waitOk;

  const send = () => {
    if (!ready || !d.recommend || !d.reason) return;
    submit.mutate(
      {
        visit,
        existing,
        reviewerName: me.data?.name,
        body: {
          ratings: ratings as ReviewRatings,
          wouldRecommend: d.recommend,
          reason: d.reason,
          ...(trimmed ? { text: trimmed } : {}),
          ...(waitNum !== undefined ? { waitedMinutes: waitNum } : {}),
        },
      },
      {
        onSuccess: (review) => setDone(review.state === 'published' ? 'published' : 'checking'),
        onError: () => toast.error(t('reviews.error')),
      },
    );
  };

  const editUntil = existing?.canEditUntil;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BackLink />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {existing ? t('reviews.editTitle') : t('reviews.title')}
        </h1>
        <p className="text-sm font-semibold text-brand-700">
          {t('reviews.visitWith', { doctor: visit.doctor.name })}
          <span className="font-medium text-ink-muted">
            {' · '}
            {fmtDate(visit.visitEndedAt)}
          </span>
        </p>
        {existing && editUntil && (
          <p className="text-xs text-ink-muted">
            {t('reviews.editNote', { date: fmtDate(editUntil) })}
          </p>
        )}
      </header>

      <section className="neu-card space-y-5 rounded-3xl p-5 sm:p-7">
        {RATING_DIMENSIONS.map((dim: RatingDimension) => (
          <StarRating
            key={dim}
            label={t(DIMENSION_KEY[dim])}
            value={ratings[dim] ?? 0}
            onChange={(n) => setRating(dim, n)}
          />
        ))}
      </section>

      <section className="neu-card space-y-5 rounded-3xl p-5 sm:p-7">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('reviews.recommendQ')}</p>
          <div
            role="radiogroup"
            aria-label={t('reviews.recommendQ')}
            className="flex flex-wrap gap-2"
          >
            {WOULD_RECOMMEND.map((r) => (
              <Chip key={r} active={d.recommend === r} onClick={() => set({ recommend: r })}>
                {t(RECOMMEND_KEY[r])}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('reviews.reasonQ')}</p>
          <div role="radiogroup" aria-label={t('reviews.reasonQ')} className="flex flex-wrap gap-2">
            {VISIT_REASONS.map((r) => (
              <Chip key={r} active={d.reason === r} onClick={() => set({ reason: r })}>
                {t(REASON_KEY[r])}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <section className="neu-card space-y-4 rounded-3xl p-5 sm:p-7">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">{t('reviews.textLabel')}</span>
          <textarea
            value={d.text}
            maxLength={REVIEW_TEXT_MAX}
            rows={5}
            onChange={(e) => set({ text: e.target.value })}
            aria-invalid={textOk ? undefined : true}
            className="neu-inset w-full resize-y rounded-2xl bg-transparent px-4 py-3 text-base text-ink focus:outline-none"
          />
          <span className="flex items-start justify-between gap-3 text-xs text-ink-muted">
            <span>{t('reviews.textHint')}</span>
            <span className="shrink-0 tabular-nums">
              {t('reviews.textCount', { count: d.text.length })}
            </span>
          </span>
          {!textOk && (
            <span role="alert" className="block text-sm text-danger">
              {t('reviews.textError')}
            </span>
          )}
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">{t('reviews.waitLabel')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={REVIEW_WAIT_MAX_MINUTES}
            value={d.wait}
            onChange={(e) => set({ wait: e.target.value })}
            aria-invalid={waitOk ? undefined : true}
            className="neu-inset h-12 w-32 rounded-2xl bg-transparent px-4 text-base text-ink focus:outline-none"
          />
        </label>
      </section>

      <div className="space-y-2">
        <Button type="button" size="lg" disabled={!ready} loading={submit.isPending} onClick={send}>
          {existing ? t('reviews.saveChanges') : t('reviews.submit')}
        </Button>
        {!ready && <p className="text-center text-xs text-ink-muted">{t('reviews.missing')}</p>}
      </div>
    </div>
  );
}

/** When the review form opens, as a short phrase (used by the appointments screens). */
export function opensIn(visitEndedAt: string, now: number): number {
  return Math.max(
    1,
    Math.ceil((Date.parse(reviewWindow(visitEndedAt).unlocksAt) - now) / 3_600_000),
  );
}
