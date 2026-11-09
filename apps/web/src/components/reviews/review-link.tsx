'use client';

import { Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import type { AppointmentCardData } from '@/lib/appointments-view';
import { useNow } from '@/lib/use-now';
import { opensIn } from './review-page';
import { useReviewEligibility } from './use-reviews';

/**
 * What a finished visit offers about reviewing: a button when the form is open, a note while it
 * is still locked, and a way back to the review the patient already wrote. Nothing once closed.
 */
export function ReviewLink({ a, large }: { a: AppointmentCardData; large?: boolean }) {
  const { t } = useI18n();
  const now = useNow();
  const { items } = useReviewEligibility();
  const visit = items.find((x) => x.appointmentId === a.id);
  if (a.status !== 'completed' || !visit || now === 0) return null;

  const href = `/appointments/${a.id}/review`;
  const size = large ? 'lg' : 'sm';

  if (visit.state === 'open') {
    return (
      <Link href={href} className={buttonVariants({ size, className: 'w-auto px-5' })}>
        <Star className="size-4" fill="currentColor" aria-hidden />
        {t('reviews.rateCta')}
      </Link>
    );
  }
  if (visit.state === 'reviewed') {
    return (
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Star className="size-4 text-warning" fill="currentColor" aria-hidden />
        {t('reviews.rated')}
      </Link>
    );
  }
  if (visit.state === 'locked') {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
        <Clock className="size-4 shrink-0" aria-hidden />
        {t('reviews.rateLocked', {
          when: t('reviews.lockedIn', { hours: opensIn(visit.visitEndedAt, now) }),
        })}
      </p>
    );
  }
  return null;
}
