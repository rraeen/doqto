'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Input } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip, type StatusTone } from '@doqto/ui/status-chip';
import type { AppointmentStatus, DaySheetItem } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import {
  authErrorKey,
  confirmAppointment,
  dayKey,
  getDay,
  getUpcoming,
  getWaiting,
  upcomingKey,
  waitingKey,
} from '@/lib/auth';
import { formatTime, istToday, shiftDate } from '@/lib/dates';
import { useClinicUnit } from './schedule-editor';

export const TONE: Record<AppointmentStatus, StatusTone> = {
  pending_payment: 'neutral',
  pending_confirmation: 'warning',
  confirmed: 'info',
  checked_in: 'info',
  in_consult: 'info',
  completed: 'success',
  no_show: 'danger',
  cancelled_by_patient: 'neutral',
  cancelled_by_clinic: 'neutral',
  expired: 'neutral',
};

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

function Row({
  item,
  showDate,
  onConfirm,
  confirming,
}: {
  item: DaySheetItem;
  showDate: boolean;
  onConfirm: (id: string) => void;
  confirming: boolean;
}) {
  const t = useT();
  return (
    <tr className="hover:bg-surface">
      <td className="whitespace-nowrap px-4 py-3 text-ink">
        {showDate && <span className="block text-xs text-ink-muted">{dayLabel(item.date)}</span>}
        {formatTime(item.slotStart)}
      </td>
      <td className="px-4 py-3">
        <span className="block font-semibold text-ink">{item.patientName}</span>
        {item.rescheduled && (
          <span className="mt-1 inline-block rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
            {t('appointments.moved')}
          </span>
        )}
        <span className="block text-xs text-ink-muted">{item.patientPhone}</span>
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {t(('appointments.source.' + item.source) as Parameters<typeof t>[0])}
      </td>
      <td className="px-4 py-3">
        <StatusChip tone={TONE[item.status]}>
          {t(('appointments.status.' + item.status) as Parameters<typeof t>[0])}
        </StatusChip>
      </td>
      <td className="px-4 py-3 text-right">
        {item.status === 'pending_confirmation' && (
          <Button size="sm" loading={confirming} onClick={() => onConfirm(item.id)}>
            {t('appointments.confirm')}
          </Button>
        )}
      </td>
    </tr>
  );
}

function Head({ showDate }: { showDate: boolean }) {
  const t = useT();
  return (
    <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
      <tr>
        <th className="px-4 py-2 font-semibold">
          {showDate ? t('appointments.when') : t('appointments.time')}
        </th>
        <th className="px-4 py-2 font-semibold">{t('appointments.patient')}</th>
        <th className="px-4 py-2 font-semibold">{t('appointments.source.title')}</th>
        <th className="px-4 py-2 font-semibold">{t('appointments.statusTitle')}</th>
        <th className="px-4 py-2" />
      </tr>
    </thead>
  );
}

/**
 * Bookings of the signed-in clinic or doctor: first the paid bookings waiting to be accepted (any
 * date), then one day's list. Accepting a booking creates the patient's visit code and tells them.
 */
export function AppointmentsScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const { unitId, loading } = useClinicUnit();
  const [date, setDate] = useState(istToday);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const waiting = useQuery({
    queryKey: waitingKey(unitId ?? ''),
    queryFn: () => getWaiting(unitId!),
    enabled: Boolean(unitId),
    refetchInterval: 30_000,
  });
  const upcoming = useQuery({
    queryKey: upcomingKey(unitId ?? ''),
    queryFn: () => getUpcoming(unitId!),
    enabled: Boolean(unitId),
    refetchInterval: 30_000,
  });
  const day = useQuery({
    queryKey: dayKey(unitId ?? '', date),
    queryFn: () => getDay(unitId!, date),
    enabled: Boolean(unitId),
    refetchInterval: 30_000,
  });

  const confirm = useMutation({
    mutationFn: (id: string) => confirmAppointment(unitId!, id),
    onSuccess: async () => {
      setError(undefined);
      setDone(t('appointments.confirmed'));
      await queryClient.invalidateQueries({ queryKey: ['console', 'appointments'] });
    },
    onError: async (err) => {
      setDone(undefined);
      setError(isApiError(err, 'CONFLICT') ? t('appointments.changed') : t(authErrorKey(err)));
      await queryClient.invalidateQueries({ queryKey: ['console', 'appointments'] });
    },
  });

  const header = (
    <PageHeader
      title={t('areas.appointments.title')}
      description={t('areas.appointments.description')}
    />
  );
  if (loading) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-ink-muted">
          {t('common.loading')}
        </p>
      </>
    );
  }
  if (!unitId) {
    return (
      <>
        {header}
        <Panel>
          <p className="p-4 text-sm text-ink-muted">{t('appointments.notApproved')}</p>
        </Panel>
      </>
    );
  }

  const waitingItems = waiting.data ?? [];
  const items = day.data?.items ?? [];
  const upcomingItems = upcoming.data ?? [];

  return (
    <>
      {header}
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mb-4 text-sm text-success">
          {done}
        </p>
      )}

      <Panel
        className="mb-6"
        title={t('appointments.waitingTitle', { n: waitingItems.length })}
        description={t('appointments.waitingHint')}
      >
        {waiting.isPending ? (
          <p role="status" className="p-4 text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : waitingItems.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">{t('appointments.waitingNone')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <Head showDate />
              <tbody className="divide-y divide-line">
                {waitingItems.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    showDate
                    onConfirm={(id) => confirm.mutate(id)}
                    confirming={confirm.isPending && confirm.variables === i.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        className="mb-6"
        title={t('appointments.upcomingTitle', { n: upcomingItems.length })}
        description={t('appointments.upcomingHint')}
      >
        {upcoming.isPending ? (
          <p role="status" className="p-4 text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : upcomingItems.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">{t('appointments.upcomingNone')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <Head showDate />
              <tbody className="divide-y divide-line">
                {upcomingItems.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    showDate
                    onConfirm={(id) => confirm.mutate(id)}
                    confirming={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={t('appointments.dayTitle')}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('appointments.prevDay')}
              onClick={() => setDate((d) => shiftDate(d, -1))}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <Input
              type="date"
              aria-label={t('appointments.pickDay')}
              className="w-44"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('appointments.nextDay')}
              onClick={() => setDate((d) => shiftDate(d, 1))}
            >
              <ChevronRight className="size-5" aria-hidden />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDate(istToday())}>
              {t('appointments.today')}
            </Button>
          </div>
        }
      >
        {day.isPending ? (
          <p role="status" className="p-4 text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">{t('appointments.dayNone')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <Head showDate={false} />
              <tbody className="divide-y divide-line">
                {items.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    showDate={false}
                    onConfirm={(id) => confirm.mutate(id)}
                    confirming={confirm.isPending && confirm.variables === i.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/** A reminder on the clinic dashboard when bookings wait for the doctor to accept them. */
export function WaitingCallout() {
  const t = useT();
  const { unitId } = useClinicUnit();
  const waiting = useQuery({
    queryKey: waitingKey(unitId ?? ''),
    queryFn: () => getWaiting(unitId!),
    enabled: Boolean(unitId),
    refetchInterval: 30_000,
  });
  const n = waiting.data?.length ?? 0;
  if (n === 0) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-info-bg px-4 py-3 text-sm text-info"
    >
      <span>{t('appointments.callout', { n })}</span>
      <a href="/clinic/appointments" className="font-semibold underline underline-offset-4">
        {t('appointments.review')}
      </a>
    </div>
  );
}
