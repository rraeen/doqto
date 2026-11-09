'use client';

import { HOLD_MINUTES } from '@doqto/shared';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Info,
  LogIn,
  MapPin,
  Moon,
  Star,
  Sun,
  Sunrise,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import {
  firstFree,
  istSlotOf,
  rangeOf,
  slotsOn,
  takenKey,
  type TimeRange,
} from '@/lib/availability';
import { slotIso } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { saveDemoBooking } from '@/lib/demo-bookings';
import { formatRupees } from '@/lib/money';
import { isApiError } from '@/lib/api/errors';
import { useDoctorById } from '@/lib/bookable-doctors';
import { useCreateAppointment, useSlots } from '@/lib/booking-api';
import { env } from '@/lib/env';
import { markBooked } from '@/lib/install-trigger';
import { useNow } from '@/lib/use-now';
import { doctorScore } from './booking-flow';

/** Doqto's booking fee in the demo, in paise (real doctors set theirs between ₹10 and ₹20). */
const BOOKING_FEE = 1500;

const RANGES: Array<{
  id: TimeRange;
  icon: LucideIcon;
  key: 'booking.rangeMorning' | 'booking.rangeAfternoon' | 'booking.rangeEvening';
}> = [
  { id: 'morning', icon: Sunrise, key: 'booking.rangeMorning' },
  { id: 'afternoon', icon: Sun, key: 'booking.rangeAfternoon' },
  { id: 'evening', icon: Moon, key: 'booking.rangeEvening' },
];

const REASONS = [
  { id: 'checkup', api: 'checkup', key: 'bookingConfirm.reasonCheckup' },
  { id: 'followup', api: 'follow_up', key: 'bookingConfirm.reasonFollowUp' },
  { id: 'child', api: 'child', key: 'bookingConfirm.reasonChild' },
  { id: 'women', api: 'women', key: 'bookingConfirm.reasonWomen' },
  { id: 'other', api: 'other', key: 'bookingConfirm.reasonOther' },
] as const;

type Reason = (typeof REASONS)[number];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="px-2 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function BookingConfirm({ specialties }: { specialties: Record<string, string> }) {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const { me, all, bookable } = useAppointments();
  const createBooking = useCreateAppointment();
  const router = useRouter();
  const now = useNow();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';

  const lookup = useDoctorById(params.get('doctor'));
  const doctor = lookup.doctor ?? undefined;
  const day = params.get('date');
  const wanted = params.get('time');
  const valid = Boolean(doctor && day && /^\d{4}-\d{2}-\d{2}$/.test(day));

  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const a of all) {
      if (!a.start || a.status !== 'confirmed') continue;
      const s = istSlotOf(a.start);
      set.add(takenKey(a.doctor.slug, s.day, s.time));
    }
    return set;
  }, [all]);

  const apiSlots = useSlots({
    doctorId: doctor?.id,
    clinicId: doctor?.primaryClinic?.id,
    date: day,
  });
  const slots = useMemo(() => {
    if (env.bookingApi) {
      return (apiSlots.data?.slots ?? []).map((s) => ({
        time: istSlotOf(s.start).time,
        available: true,
      }));
    }
    return now > 0 && doctor && day ? slotsOn(doctor.slug, day, now, taken) : [];
  }, [apiSlots.data, now, doctor, day, taken]);
  const free = slots.filter((s) => s.available);

  const [auto, setAuto] = useState(false);
  const [range, setRange] = useState<TimeRange | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [name, setName] = useState<string | null>(null);

  const patientName = name ?? me.data?.name ?? '';
  const time = auto
    ? (firstFree(slots)?.time ?? null)
    : (picked ?? (wanted && free.some((s) => s.time === wanted) ? wanted : null));
  const activeRange: TimeRange =
    range ?? (time ? rangeOf(time) : free[0] ? rangeOf(free[0].time) : 'morning');
  const inRange = free.filter((s) => rangeOf(s.time) === activeRange);
  const wantedGone = Boolean(wanted) && !free.some((s) => s.time === wanted) && !picked && !auto;

  const fmtTime = (hhmm: string) =>
    new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(slotIso('2026-01-01', hhmm)));
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T00:00:00Z`));

  const nameOk = patientName.trim().length >= 2;
  const booking = createBooking.isPending;
  const canBook = Boolean(me.data && bookable && time && reason && nameOk && !booking);
  const fee = apiSlots.data?.bookingFee ?? BOOKING_FEE;

  const book = () => {
    if (!doctor || !day || !time || !reason || !nameOk) return;
    const start = slotIso(day, time);
    if (env.bookingApi) {
      const clinicId = doctor.primaryClinic?.id;
      if (!clinicId || !me.data) return;
      createBooking.mutate(
        {
          doctorId: doctor.id,
          clinicId,
          slotStart: start,
          patientName: patientName.trim(),
          patientPhone: me.data.phone,
          reason: reason.api,
        },
        {
          onSuccess: ({ appointment }) => {
            markBooked();
            toast.success(t('bookingConfirm.slotHeld'));
            router.push(`/appointments/${appointment.id}`);
          },
          onError: (err) => {
            // Someone else took the slot: slots refresh and the patient picks another time.
            setPicked(null);
            setAuto(false);
            toast.error(
              isApiError(err, 'SLOT_TAKEN')
                ? t('bookingConfirm.slotGone')
                : t('common.somethingWrong'),
            );
          },
        },
      );
      return;
    }
    const demoId = `demo-${Date.now()}`;
    saveDemoBooking({
      id: demoId,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        slug: doctor.slug,
        specialty: doctor.specialties.map((s) => specialties[s] ?? s).join(', '),
      },
      clinic: { name: doctor.primaryClinic?.name ?? '', area: doctor.primaryClinic?.area ?? null },
      start,
      status: 'pending_payment',
      bookedAt: new Date().toISOString(),
      fee: BOOKING_FEE,
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
    });
    markBooked();
    toast.success(t('bookingConfirm.slotHeld'));
    router.push(`/appointments/${demoId}`);
  };

  if (me.isPending || lookup.isPending) return null;

  if (!valid || !doctor || !day) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('bookingConfirm.notFound')}
        action={
          <Link
            href="/appointments/new"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('bookingConfirm.start')}
          </Link>
        }
      />
    );
  }

  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('bookingConfirm.signIn')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/appointments/new/confirm?${params}`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }

  const score = doctorScore(doctor);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/appointments/new"
          className="flex items-center gap-1 font-semibold text-brand-700"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('bookingConfirm.crumbBook')}
        </Link>
        <span className="text-ink-muted">/</span>
        <span className="font-medium text-ink-muted">{doctor.name}</span>
        <span className="text-ink-muted">/</span>
        <span className="font-bold text-ink">{t('bookingConfirm.crumbConfirm')}</span>
      </nav>

      <header className="neu-card flex flex-col items-center gap-8 rounded-xl p-6 sm:p-8 md:flex-row">
        <span className="relative shrink-0">
          <span
            aria-hidden
            className="flex size-32 items-center justify-center overflow-hidden rounded-full border-4 border-brand-500/50 bg-brand-500/10 text-brand-700"
          >
            <UserRound className="mt-5 size-24" fill="currentColor" strokeWidth={1.2} />
          </span>
          {score !== null && score >= 4.8 && (doctor.ratingSummary?.count ?? 0) >= 100 && (
            <span className="neu-glow absolute -bottom-2 -right-2 rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-wider">
              {t('bookingConfirm.topRated')}
            </span>
          )}
        </span>
        <div className="text-center md:text-left">
          <h1 className="mb-1 text-3xl font-bold text-ink">{doctor.name}</h1>
          <p className="mb-2 text-lg font-semibold text-brand-700">
            {doctor.specialties.map((s) => specialties[s] ?? s).join(', ')}
            {doctor.primaryClinic ? ` • ${doctor.primaryClinic.name}` : ''}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-ink-muted md:justify-start">
            {score !== null && (
              <span className="flex items-center gap-1">
                <Star className="size-5 text-warning" fill="currentColor" aria-hidden />
                <b className="text-ink">{score.toFixed(1)}</b>
                <span className="text-sm">
                  ({t('bookingConfirm.reviews', { count: doctor.ratingSummary?.count ?? 0 })})
                </span>
              </span>
            )}
            {doctor.experienceYears ? (
              <span className="flex items-center gap-1 text-sm font-medium">
                <BadgeCheck className="size-4 text-brand-600" aria-hidden />
                {t('doctorPage.experience', { years: doctor.experienceYears })}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <Section title={t('bookingConfirm.scheduleTitle')}>
        <div className="neu-card space-y-6 rounded-xl p-6">
          <p className="flex items-center gap-3 text-lg font-bold text-ink">
            <CalendarDays className="size-5 text-brand-600" aria-hidden />
            {fmtDay(day)}
          </p>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="size-6 shrink-0 accent-brand-600"
            />
            <span className="text-lg font-bold text-ink">{t('bookingConfirm.autoAssign')}</span>
          </label>
          {auto ? (
            <p className="flex items-center gap-2 rounded-xl bg-brand-500/10 px-4 py-3 font-bold text-brand-700">
              <Clock className="size-5" aria-hidden />
              {time
                ? t('bookingConfirm.autoPicked', { time: fmtTime(time) })
                : t('booking.noSlots')}
            </p>
          ) : (
            <div className="space-y-4">
              <p className="px-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {t('bookingConfirm.timeRange')}
              </p>
              <div
                role="radiogroup"
                aria-label={t('bookingConfirm.timeRange')}
                className="grid grid-cols-3 gap-3 sm:gap-4"
              >
                {RANGES.map((r) => {
                  const active = r.id === activeRange;
                  const count = free.filter((s) => rangeOf(s.time) === r.id).length;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={count === 0}
                      onClick={() => setRange(r.id)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-full py-4 text-sm font-bold transition-all disabled:opacity-40',
                        active ? 'neu-glow' : 'neu-raised text-ink hover:brightness-105',
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {t(r.key)}
                    </button>
                  );
                })}
              </div>
              <p className="px-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {t('bookingConfirm.pickSlot')}
              </p>
              {inRange.length === 0 ? (
                <p className="px-2 text-sm text-ink-muted">{t('bookingConfirm.noneInRange')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {inRange.map((s) => {
                    const selected = s.time === time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPicked(s.time)}
                        className={cn(
                          'rounded-full px-2 py-2.5 text-center text-sm font-bold',
                          selected
                            ? 'neu-inset border-2 border-brand-500 text-ink'
                            : 'neu-raised text-ink hover:brightness-105',
                        )}
                      >
                        {fmtTime(s.time)}
                      </button>
                    );
                  })}
                </div>
              )}
              {wantedGone && (
                <p role="alert" className="px-2 text-sm font-medium text-danger">
                  {t('bookingConfirm.slotGone')}
                </p>
              )}
            </div>
          )}
        </div>
        {doctor.primaryClinic && (
          <p className="flex items-center gap-2 px-4 text-sm text-ink-muted">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {[doctor.primaryClinic.name, doctor.primaryClinic.area].filter(Boolean).join(', ')}
          </p>
        )}
      </Section>

      <Section title={t('bookingConfirm.detailsTitle')}>
        <div className="space-y-6">
          <label className="block space-y-2">
            <span className="px-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {t('bookingConfirm.patientName')}
            </span>
            <Input
              value={patientName}
              maxLength={80}
              autoComplete="name"
              aria-invalid={name !== null && !nameOk ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="block px-2 text-xs text-ink-muted">
              {t('bookingConfirm.patientNameHint')}
            </span>
            {name !== null && !nameOk && (
              <span role="alert" className="block px-2 text-sm text-danger">
                {t('bookingConfirm.nameError')}
              </span>
            )}
          </label>
          <div className="space-y-3">
            <p className="px-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {t('bookingConfirm.reasonTitle')}
            </p>
            <div
              role="radiogroup"
              aria-label={t('bookingConfirm.reasonTitle')}
              className="flex flex-wrap gap-3"
            >
              {REASONS.map((r) => {
                const active = reason?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setReason(r)}
                    className={cn(
                      'rounded-full px-5 py-2.5 text-sm font-bold',
                      active
                        ? 'neu-inset border-2 border-brand-500 text-ink'
                        : 'neu-raised text-ink hover:brightness-105',
                    )}
                  >
                    {t(r.key)}
                  </button>
                );
              })}
            </div>
            <p className="px-2 text-xs text-ink-muted">{t('bookingConfirm.reasonHint')}</p>
          </div>
        </div>
      </Section>

      <Section title={t('bookingConfirm.paymentTitle')}>
        <div className="neu-card space-y-4 rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium text-ink-muted">
              {t('bookingConfirm.consultFee')}
              <span className="block text-xs">{t('bookingConfirm.atClinic')}</span>
            </span>
            <span className="font-bold text-ink">
              {doctor.consultFee !== null ? formatRupees(doctor.consultFee) : '–'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium text-ink-muted">{t('bookingConfirm.bookingFee')}</span>
            <span className="font-bold text-ink">{formatRupees(fee)}</span>
          </div>
          <div className="h-px bg-line" />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xl font-bold text-ink">{t('bookingConfirm.dueNow')}</span>
            <span className="text-3xl font-bold text-brand-700">{formatRupees(fee)}</span>
          </div>
        </div>
      </Section>

      <div className="flex flex-col items-center gap-4">
        <Button type="button" size="lg" disabled={!canBook} loading={booking} onClick={book}>
          {t('bookingConfirm.continueToPay')}
        </Button>
        <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <Info className="size-4 text-brand-600" aria-hidden />
          {t('bookingConfirm.demoPay')}
        </p>
      </div>
    </div>
  );
}
