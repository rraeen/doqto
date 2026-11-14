'use client';

import type { LabBooking, LabBookingStatus } from '@doqto/shared';
import { FlaskConical, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { useMyLabBookings } from '@/lib/labs';
import { formatRupees } from '@/lib/money';
import { useMe } from '@/lib/session';

export const LAB_STATUS_TONE: Record<LabBookingStatus, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  requested: 'warning',
  accepted: 'info',
  sample_collected: 'info',
  processing: 'info',
  report_ready: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled_by_patient: 'neutral',
  expired: 'neutral',
  no_show: 'danger',
};

export function LabStatusBadge({ status }: { status: LabBookingStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={LAB_STATUS_TONE[status]}>
      {t(`labs.status.${status}` as `labs.status.${LabBookingStatus}`)}
    </Badge>
  );
}

function Row({ b }: { b: LabBooking }) {
  const { t, locale } = useI18n();
  return (
    <li>
      <Link
        href={`/lab-bookings/${b.id}`}
        className="neu-card block space-y-2 rounded-3xl p-5 transition-colors hover:brightness-105"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-ink">{b.lab.name}</p>
          <LabStatusBadge status={b.status} />
        </div>
        <p className="text-sm text-ink">{b.items.map((i) => i.name).join(', ')}</p>
        <p className="text-sm text-ink-muted">
          {t('labs.when', {
            date: b.collection.date,
            window: t(`labs.window_${b.collection.window}` as const),
          })}{' '}
          · {formatRupees(b.totalPaise, locale === 'hi' ? 'hi-IN' : 'en-IN')}
        </p>
      </Link>
    </li>
  );
}

/** The patient's lab bookings, newest first; the list refreshes while the lab answers. */
export function LabBookingsPage() {
  const { t } = useI18n();
  const me = useMe();
  const list = useMyLabBookings(Boolean(me.data));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t('labs.bookingsTitle')}</h1>
        <Link href="/labs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('labs.bookNow')}
        </Link>
      </div>
      {me.isPending || (me.data && list.isPending) ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      ) : !me.data ? (
        <EmptyState
          icon={LogIn}
          title={t('labs.signInBody')}
          action={
            <Link href="/login?next=%2Flab-bookings" className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}>
              {t('home.signIn')}
            </Link>
          }
        />
      ) : list.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t('common.somethingWrong')}
        </p>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={t('labs.bookingsNone')}
          action={
            <Link href="/labs" className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}>
              {t('labs.bookNow')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {(list.data?.items ?? []).map((b) => (
            <Row key={b.id} b={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
