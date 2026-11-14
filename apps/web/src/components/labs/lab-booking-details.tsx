'use client';

import { ArrowLeft, Download, FlaskConical, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { downloadLabReport, useCancelLabBooking, useMyLabBooking } from '@/lib/labs';
import { formatRupees } from '@/lib/money';
import { useMe } from '@/lib/session';
import { LabStatusBadge } from './lab-bookings-page';

/** One lab booking: the code to show at the lab, where it is now, cancel, and the report. */
export function LabBookingDetails({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const me = useMe();
  const q = useMyLabBooking(id, Boolean(me.data));
  const cancel = useCancelLabBooking(id);
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);
  const money = (p: number) => formatRupees(p, locale === 'hi' ? 'hi-IN' : 'en-IN');

  if (me.isPending || (me.data && q.isPending)) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('labs.signInBody')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/lab-bookings/${id}`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t('labs.detailsNotFound')}
        action={
          <Link href="/lab-bookings" className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}>
            {t('labs.myBookings')}
          </Link>
        }
      />
    );
  }
  const b = q.data;
  const canCancel = b.status === 'requested' || b.status === 'accepted';

  async function openReport() {
    setOpening(true);
    try {
      await downloadLabReport(id);
    } catch {
      toast.error(t('labs.reportFailed'));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/lab-bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="size-4" aria-hidden /> {t('labs.myBookings')}
      </Link>

      <header className="neu-card space-y-3 rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/labs/${b.lab.slug}`} className="text-xl font-bold text-ink underline-offset-4 hover:underline">
            {b.lab.name}
          </Link>
          <LabStatusBadge status={b.status} />
        </div>
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-brand-700">
          {t('labs.code', { code: b.code })}
        </p>
        <p className="text-sm text-ink-muted">
          {b.collection.mode === 'home' ? t('labs.homeVisit') : t('labs.visit')} ·{' '}
          {t('labs.when', {
            date: b.collection.date,
            window: t(`labs.window_${b.collection.window}` as const),
          })}
        </p>
        {b.collection.address && <p className="text-sm text-ink-muted">{b.collection.address}</p>}
        {b.status === 'requested' && <p className="text-sm text-warning">{t('labs.waiting')}</p>}
        {b.rejectReason && <p className="text-sm text-danger">{t('labs.reason', { reason: b.rejectReason })}</p>}
      </header>

      <section className="neu-card space-y-2 rounded-3xl p-5" aria-label={t('labs.catalogueTitle')}>
        <ul className="divide-y divide-line">
          {b.items.map((i) => (
            <li key={i.testId} className="flex justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-ink">{i.name}</span>
              <span className="text-ink-muted">{money(i.pricePaise)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-line pt-2 text-sm font-bold text-ink">
          <span>{t('labs.total', { amount: money(b.totalPaise) })}</span>
        </p>
        <p className="text-xs text-ink-muted">{t('labs.payAtLab')}</p>
      </section>

      {b.reportReady && (
        <Button size="lg" className="w-full" loading={opening} onClick={openReport}>
          <Download className="size-5" aria-hidden /> {t('labs.downloadReport')}
        </Button>
      )}

      <section className="neu-card space-y-2 rounded-3xl p-5" aria-labelledby="history-title">
        <h2 id="history-title" className="text-base font-bold text-ink">
          {t('labs.history')}
        </h2>
        <ol className="space-y-2">
          {b.history.map((h, i) => (
            <li key={`${h.status}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <LabStatusBadge status={h.status} />
              <time className="text-ink-muted" dateTime={h.at}>
                {new Date(h.at).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>

      {canCancel && (
        <>
          <Button variant="outline" className="w-full" onClick={() => setConfirming(true)}>
            {t('labs.cancel')}
          </Button>
          <ConfirmSheet
            open={confirming}
            onOpenChange={setConfirming}
            title={t('labs.cancelTitle')}
            description={t('labs.cancelBody')}
            confirmLabel={t('labs.cancelYes')}
            cancelLabel={t('labs.cancelNo')}
            danger
            loading={cancel.isPending}
            onConfirm={() =>
              cancel.mutate(undefined, {
                onSuccess: () => {
                  setConfirming(false);
                  toast.success(t('labs.cancelled'));
                },
                onError: () => {
                  setConfirming(false);
                  toast.error(t('labs.cancelFailed'));
                },
              })
            }
          />
        </>
      )}
    </div>
  );
}
