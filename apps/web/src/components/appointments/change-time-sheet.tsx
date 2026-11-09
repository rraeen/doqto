'use client';

import { canReschedule } from '@doqto/shared';
import { CalendarClock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import type { AppointmentCardData } from '@/lib/appointments-view';
import { isApiError } from '@/lib/api/errors';
import { istSlotOf, slotsOn } from '@/lib/availability';
import { addDays, slotIso, todayIst } from '@/lib/booking';
import { useRescheduleAppointment, useSlots } from '@/lib/booking-api';
import { cn } from '@/lib/cn';
import { changeDemoBooking } from '@/lib/demo-bookings';
import { useNow } from '@/lib/use-now';

/** Days offered in the picker; the API's own window is checked by the server. */
const DAYS_SHOWN = 7;

/**
 * "Change time": pick another day and slot for a confirmed booking. The fee already paid and the
 * visit code carry over. Allowed up to 2 hours before the visit.
 */
export function ChangeTimeSheet({ a, className }: { a: AppointmentCardData; className?: string }) {
  const { t, locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const move = useRescheduleAppointment();

  const today = now > 0 ? todayIst(now) : '';
  const days = useMemo(
    () => (today ? Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)) : []),
    [today],
  );
  const selected = day ?? days[0] ?? null;

  const apiSlots = useSlots({
    doctorId: a.api?.doctorId,
    clinicId: a.api?.clinicId,
    date: selected,
  });
  const free = useMemo(() => {
    if (!selected) return [];
    if (a.api) return (apiSlots.data?.slots ?? []).map((s) => istSlotOf(s.start).time);
    if (now === 0) return [];
    return slotsOn(a.doctor.slug, selected, now)
      .filter((s) => s.available)
      .map((s) => s.time);
  }, [a.api, a.doctor.slug, apiSlots.data, selected, now]);

  if (now === 0 || !canReschedule({ status: a.status, slotStart: a.start, now })) return null;

  const fmtTime = (hhmm: string) =>
    new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(slotIso('2026-01-01', hhmm)));
  const weekday = (d: string) =>
    new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const dayNumber = (d: string) =>
    new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setDay(null);
      setTime(null);
    }
  };

  const confirm = () => {
    if (!selected || !time) return;
    const slotStart = slotIso(selected, time);
    if (!a.api) {
      changeDemoBooking(a.id, { start: slotStart });
      toast.success(t('appointments.timeChanged'));
      reset(false);
      return;
    }
    move.mutate(
      { id: a.id, slotStart },
      {
        onSuccess: () => {
          toast.success(t('appointments.timeChanged'));
          reset(false);
        },
        onError: (err) => {
          setTime(null);
          toast.error(
            isApiError(err, 'SLOT_TAKEN')
              ? t('bookingConfirm.slotGone')
              : t('common.somethingWrong'),
          );
        },
      },
    );
  };

  const loading = Boolean(a.api) && apiSlots.isPending;

  return (
    <Sheet
      open={open}
      onOpenChange={reset}
      title={t('appointments.changeTimeTitle')}
      description={t('appointments.changeTimeHint')}
      closeLabel={t('common.close')}
      trigger={
        <Button type="button" variant="outline" size="sm" className={className ?? 'px-5'}>
          <CalendarClock className="size-4" aria-hidden />
          {t('appointments.changeTime')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div
          role="radiogroup"
          aria-label={t('appointments.pickDay')}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {days.map((d) => {
            const active = d === selected;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setDay(d);
                  setTime(null);
                }}
                className={cn(
                  'flex min-h-14 min-w-16 shrink-0 flex-col items-center justify-center rounded-2xl px-3 text-center',
                  active ? 'neu-glow' : 'neu-raised text-ink',
                )}
              >
                <span className="text-2xs font-semibold uppercase tracking-wide">{weekday(d)}</span>
                <span className="text-sm font-bold">{dayNumber(d)}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-muted">{t('appointments.pickSlot')}</p>
          {loading ? (
            <div className="grid grid-cols-3 gap-2" aria-busy>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 rounded-full" />
              ))}
            </div>
          ) : free.length === 0 ? (
            <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
              {t('appointments.noSlotsDay')}
            </p>
          ) : (
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto p-1">
              {free.map((s) => {
                const on = s === time;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTime(s)}
                    className={cn(
                      'min-h-10 rounded-full px-2 text-center text-sm font-bold',
                      on ? 'neu-inset border-2 border-brand-500 text-ink' : 'neu-raised text-ink',
                    )}
                  >
                    {fmtTime(s)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button type="button" size="lg" disabled={!time} loading={move.isPending} onClick={confirm}>
          {t('appointments.confirmNewTime')}
        </Button>
      </div>
    </Sheet>
  );
}
