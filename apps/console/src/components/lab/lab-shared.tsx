'use client';

import { isApiError } from '@doqto/api-client';
import type { LabBookingStatus, LabConsoleBooking } from '@doqto/shared';
import { StatusChip, type StatusTone } from '@doqto/ui/status-chip';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@/i18n/provider';
import { getMe, meKey } from '@/lib/auth';
import { getLabBookings, labBookingsKey } from '@/lib/lab-api';

/** The approved lab service of the signed-in account (what the lab screens work on). */
export function useLabUnit() {
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const unit = me.data?.workspaces.find((w) => w.kind === 'lab' && w.status === 'verified');
  return { unitId: unit?.id, unit, loading: me.isPending };
}

/** The lab's bookings, refreshed every half minute while a screen is open. */
export function useLabBookings(unitId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: labBookingsKey(unitId ?? ''),
    queryFn: () => getLabBookings(unitId!),
    enabled: Boolean(unitId) && enabled,
    refetchInterval: 30_000,
  });
}

export const rupees = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const TONES: Record<LabBookingStatus, StatusTone> = {
  requested: 'warning',
  accepted: 'info',
  sample_collected: 'info',
  processing: 'info',
  report_ready: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled_by_patient: 'danger',
  expired: 'neutral',
  no_show: 'danger',
};

export function BookingStatus({ status }: { status: LabBookingStatus }) {
  const t = useT();
  return (
    <StatusChip tone={TONES[status]}>{t(('lab.status.' + status) as Parameters<typeof t>[0])}</StatusChip>
  );
}

/** Why a lab request failed, in the person's language. */
export function useLabErrorText() {
  const t = useT();
  return (err: unknown): string => {
    if (isApiError(err, 'CONFLICT')) return t('lab.refresh') + ': ' + err.message;
    if (isApiError(err, 'FORBIDDEN')) return t('staff.ownerOnly');
    return t('common.somethingWrong');
  };
}

/** The booking's facts, the same on every lab screen. */
export function BookingFacts({ b }: { b: LabConsoleBooking }) {
  const t = useT();
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{b.patientName}</span>
        <span className="text-sm text-ink-muted">{b.patientPhone}</span>
        <BookingStatus status={b.status} />
        <span className="rounded-sm bg-surface px-2 py-0.5 font-mono text-xs text-ink-muted">
          {t('lab.card.code', { code: b.code })}
        </span>
      </div>
      <p className="text-sm text-ink">{b.items.map((i) => i.name).join(', ')}</p>
      <p className="text-sm text-ink-muted">
        {t('lab.card.total', { amount: rupees(b.totalPaise) })}
      </p>
      <p className="text-sm text-ink-muted">
        {t(('lab.mode.' + b.collection.mode) as Parameters<typeof t>[0])} ·{' '}
        {t('lab.card.when', {
          date: b.collection.date,
          window: t(('lab.window.' + b.collection.window) as Parameters<typeof t>[0]),
        })}
      </p>
      {b.collection.address && (
        <p className="text-sm text-ink-muted">{t('lab.collection.address', { address: b.collection.address })}</p>
      )}
      {b.note && <p className="text-sm text-ink-muted">{t('lab.card.note', { note: b.note })}</p>}
      {b.rejectReason && (
        <p className="text-sm text-danger">{t('lab.card.reason', { reason: b.rejectReason })}</p>
      )}
    </div>
  );
}
