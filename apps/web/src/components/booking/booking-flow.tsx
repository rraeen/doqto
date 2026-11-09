'use client';

import type { DoctorListItem } from '@doqto/shared';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  RotateCcw,
  Search,
  Star,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { doctorReference } from '@doqto/shared';
import { useMemo, useState } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { availableDays, istSlotOf, nextAvailable, takenKey, workingDays } from '@/lib/availability';
import { addDays, monthGrid, slotIso, todayIst } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { useBookableDoctors, useDoctorById } from '@/lib/bookable-doctors';
import { useNow } from '@/lib/use-now';

export type VisitType = 'general' | 'specialist' | 'followup';

const TYPES: Array<{ id: VisitType; icon: LucideIcon; title: string; body: string }> = [
  {
    id: 'general',
    icon: ClipboardPlus,
    title: 'booking.typeGeneral',
    body: 'booking.typeGeneralBody',
  },
  {
    id: 'specialist',
    icon: Stethoscope,
    title: 'booking.typeSpecialist',
    body: 'booking.typeSpecialistBody',
  },
  {
    id: 'followup',
    icon: RotateCcw,
    title: 'booking.typeFollowUp',
    body: 'booking.typeFollowUpBody',
  },
];

function StepTitle({ n, children }: { n: number; children: string }) {
  return (
    <h2 className="mb-5 flex items-center gap-3 text-xl font-bold text-ink">
      <span className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-ink">
        {n}
      </span>
      {children}
    </h2>
  );
}

export function doctorScore(d: DoctorListItem): number | null {
  const r = d.ratingSummary;
  if (!r || r.count === 0) return null;
  return (r.waitTime + r.explanation + r.behaviour + r.facilities + r.valueForMoney) / 5;
}

export function BookingFlow({ specialties }: { specialties: Record<string, string> }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { all, bookable } = useAppointments();
  const { doctors: bookableDoctors } = useBookableDoctors({ allCities: true });
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const now = useNow();
  const ready = now > 0;
  const today = ready ? todayIst(now) : '';

  const [typePicked, setType] = useState<VisitType | null>(null);
  const [query, setQuery] = useState('');
  // `?doctor=<id>` (from "Book" on a search card or a profile) fixes the booking to that one
  // doctor, found by their unique id; without it the patient picks from the list.
  const [doctorPicked, setDoctor] = useState<DoctorListItem | null>(null);
  const wanted = params.get('doctor');
  const lookup = useDoctorById(wanted);
  const fixed = Boolean(wanted);
  const doctor = fixed ? lookup.doctor : doctorPicked;
  const type: VisitType = typePicked ?? 'general';
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [date, setDate] = useState<string | null>(null);

  // Slots the patient already booked in the demo are no longer free.
  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const a of all) {
      if (!a.start || a.status !== 'confirmed') continue;
      const { day, time: hhmm } = istSlotOf(a.start);
      set.add(takenKey(a.doctor.slug, day, hhmm));
    }
    return set;
  }, [all]);

  const seen = useMemo(
    () => new Set(all.filter((a) => a.status === 'completed').map((a) => a.doctor.name)),
    [all],
  );
  const label = (d: DoctorListItem) => d.specialties.map((s) => specialties[s] ?? s).join(', ');

  const doctors = useMemo(() => {
    if (!bookable) return [];
    const needle = query.trim().toLowerCase();
    return bookableDoctors
      .filter((d) => {
        if (type === 'general') return d.specialties.includes('general_physician');
        if (type === 'specialist') return !d.specialties.includes('general_physician');
        return seen.has(d.name);
      })
      .filter(
        (d) =>
          !needle ||
          d.name.toLowerCase().includes(needle) ||
          d.specialties.some((s) => (specialties[s] ?? s).toLowerCase().includes(needle)),
      );
  }, [bookable, bookableDoctors, type, query, seen, specialties]);

  const dayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(Date.UTC(2024, 0, 7 + i)), // index 0 is Sunday
        ),
      ),
    [tag],
  );
  const daysLabel = (slug: string) => {
    const on = workingDays(slug);
    const mondayFirst = on.length === 6 && !on.includes(0);
    return mondayFirst ? `${dayNames[1]}–${dayNames[6]}` : on.map((d) => dayNames[d]).join(', ');
  };

  const fmtTime = (hhmm: string) =>
    new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(slotIso('2026-01-01', hhmm)));
  const fmtDate = (day: string, long = false) =>
    new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'short',
      ...(long ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
  const when = (day: string, hhmm: string) => {
    const lead =
      day === today
        ? t('booking.today')
        : day === addDays(today, 1)
          ? t('booking.tomorrow')
          : fmtDate(day);
    return `${lead}, ${fmtTime(hhmm)}`;
  };

  const freeDays = useMemo(
    () => (ready && doctor ? availableDays(doctor.slug, now, taken) : new Set<string>()),
    [ready, doctor, now, taken],
  );

  const shownMonth =
    month ?? (ready ? { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 } : null);
  const monthName = shownMonth
    ? new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(
        new Date(Date.UTC(shownMonth.y, shownMonth.m, 1)),
      )
    : '';
  const weekdays = Array.from({ length: 7 }, (_, i) => dayNames[(i + 1) % 7]);
  const canPrev = shownMonth
    ? shownMonth.y > Number(today.slice(0, 4)) || shownMonth.m > Number(today.slice(5, 7)) - 1
    : false;

  const choose = (d: DoctorListItem) => {
    setDoctor(d);
    const next = nextAvailable(d.slug, now, taken);
    setDate(next ? next.day : null);
    if (next) setMonth({ y: Number(next.day.slice(0, 4)), m: Number(next.day.slice(5, 7)) - 1 });
  };

  const canContinue = Boolean(doctor && date && bookable);
  const typeTitle = t(TYPES.find((x) => x.id === type)!.title as 'booking.typeGeneral');

  const next = () => {
    if (!doctor || !date) return;
    const q = new URLSearchParams({ doctor: doctor.id, date, type });
    router.push(`/appointments/new/confirm?${q}`);
  };

  if (!bookable) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('booking.comingSoon')}
        action={
          <Link
            href="/search"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            <Search className="size-5" aria-hidden />
            {t('booking.findDoctor')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {t('booking.title')}
        </h1>
        <p className="mt-1 text-lg font-medium text-brand-700">{t('booking.subtitle')}</p>
      </div>
      <p
        role="note"
        className="rounded-md bg-warning-bg px-4 py-2 text-sm font-medium text-warning"
      >
        {t('booking.previewNote')}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-10">
          {!fixed && (
            <>
              <section aria-labelledby="step-type">
                <StepTitle n={1}>{t('booking.step1')}</StepTitle>
                <div
                  role="radiogroup"
                  aria-label={t('booking.step1')}
                  id="step-type"
                  className="grid gap-5 sm:grid-cols-3"
                >
                  {TYPES.map((x) => {
                    const active = x.id === type;
                    const Icon = x.icon;
                    return (
                      <button
                        key={x.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setType(x.id);
                          setDoctor(null);
                          setDate(null);
                        }}
                        className={cn(
                          'neu-raised flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-shadow sm:flex-col sm:justify-center sm:gap-3 sm:p-6 sm:text-center',
                          active
                            ? 'border-brand-500 shadow-[0_0_18px_rgba(135,213,84,0.45)]'
                            : 'border-transparent hover:brightness-105',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12',
                            active ? 'bg-brand-500/20 text-brand-700' : 'bg-line text-ink-muted',
                          )}
                        >
                          <Icon className="size-5 sm:size-7" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-semibold text-ink sm:text-lg">
                            {t(x.title as 'booking.typeGeneral')}
                          </span>
                          <span className="mt-0.5 block text-sm text-ink-muted sm:text-xs">
                            {t(x.body as 'booking.typeGeneralBody')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="step-doctor">
                <StepTitle n={2}>{t('booking.step2')}</StepTitle>
                <label className="neu-inset mb-6 flex w-full max-w-2xl items-center gap-3 rounded-2xl px-5 py-4">
                  <Search className="size-5 shrink-0 text-ink-muted" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t('booking.searchLabel')}
                    placeholder={t('booking.searchPlaceholder')}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink placeholder:text-ink-muted/60 focus:outline-none"
                  />
                </label>
                {doctors.length === 0 ? (
                  <p className="rounded-xl p-4 text-sm text-ink-muted">
                    {type === 'followup' ? t('booking.noFollowUp') : t('booking.noDoctors')}
                  </p>
                ) : (
                  <ul
                    id="step-doctor"
                    className="max-h-[460px] space-y-4 overflow-y-auto py-2 pr-2"
                  >
                    {doctors.map((d) => {
                      const active = doctor?.id === d.id;
                      const score = doctorScore(d);
                      const soon = ready ? nextAvailable(d.slug, now, taken) : null;
                      return (
                        <li
                          key={d.id}
                          className={cn(
                            'neu-raised flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 transition-shadow',
                            active
                              ? 'border-brand-500 shadow-[0_0_18px_rgba(135,213,84,0.45)]'
                              : 'border-transparent',
                          )}
                        >
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => choose(d)}
                            className="flex min-w-[13rem] flex-1 items-center gap-4 text-left"
                          >
                            <span
                              aria-hidden
                              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-500 bg-brand-500/10 text-brand-700"
                            >
                              <UserRound
                                className="mt-2 size-11"
                                fill="currentColor"
                                strokeWidth={1.5}
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-lg font-bold text-ink">
                                {d.name}
                              </span>
                              <span className="block text-sm font-semibold text-brand-700">
                                {label(d)}
                                {d.experienceYears
                                  ? ` • ${t('doctorPage.experience', { years: d.experienceYears })}`
                                  : ''}
                              </span>
                              <span className="mt-1 block text-xs text-ink-muted">
                                {t('booking.daysLabel')}: {daysLabel(d.slug)}
                                {ready && (
                                  <span className="font-bold text-brand-700">
                                    {' · '}
                                    {soon
                                      ? t('booking.nextAvailable', {
                                          when: when(soon.day, soon.time),
                                        })
                                      : t('booking.notAvailable')}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                          <span className="flex items-center gap-3">
                            {!d.slug.startsWith('sample-') && (
                              <Link
                                href={`/d/${d.slug}`}
                                className="neu-raised flex min-h-10 items-center gap-1 rounded-full px-4 text-xs font-semibold text-ink"
                              >
                                {t('booking.viewProfile')}
                                <ChevronRight className="size-4 text-brand-600" aria-hidden />
                              </Link>
                            )}
                            <span className="flex items-center gap-1 rounded-full bg-brand-500/10 px-3 py-1 text-sm font-bold text-ink">
                              <Star
                                className="size-4 text-brand-600"
                                fill="currentColor"
                                aria-hidden
                              />
                              {score === null ? t('booking.newDoctor') : score.toFixed(1)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          {fixed && (
            <section aria-label={t('booking.fixedTitle')} className="neu-card rounded-3xl p-5">
              {lookup.isPending ? (
                <Skeleton className="h-20 w-full rounded-2xl" />
              ) : lookup.doctor ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span
                    aria-hidden
                    className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-500/10 text-brand-700"
                  >
                    <UserRound className="size-8" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                      {t('booking.fixedTitle')}
                    </p>
                    <p className="text-lg font-bold leading-snug text-ink">{lookup.doctor.name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {lookup.doctor.specialties.map((x) => specialties[x] ?? x).join(', ')}
                      {lookup.doctor.primaryClinic ? ` · ${lookup.doctor.primaryClinic.name}` : ''}
                    </p>
                    <p className="text-xs font-semibold text-ink-muted">
                      {t('doctorPage.doctorId')}: {doctorReference(lookup.doctor.id)}
                    </p>
                  </div>
                  <Link
                    href="/appointments/new"
                    className="basis-full text-sm font-bold text-brand-700 hover:underline sm:basis-auto sm:shrink-0"
                  >
                    {t('booking.changeDoctor')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="font-semibold text-ink">{t('booking.doctorNotFound')}</p>
                  <Link
                    href="/appointments/new"
                    className={buttonVariants({ size: 'sm', className: 'w-auto px-6' })}
                  >
                    {t('booking.changeDoctor')}
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <section aria-labelledby="step-date" className="neu-card rounded-xl p-6">
            <StepTitle n={fixed ? 1 : 3}>{t('booking.step3')}</StepTitle>
            <div id="step-date" className="mb-2 flex items-center justify-between px-1">
              <span className="font-bold text-ink">{monthName}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={t('booking.prevMonth')}
                  disabled={!canPrev}
                  onClick={() =>
                    shownMonth &&
                    setMonth(
                      shownMonth.m === 0
                        ? { y: shownMonth.y - 1, m: 11 }
                        : { y: shownMonth.y, m: shownMonth.m - 1 },
                    )
                  }
                  className="flex size-11 items-center justify-center rounded-full text-ink hover:text-brand-600 disabled:opacity-30"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t('booking.nextMonth')}
                  disabled={!shownMonth}
                  onClick={() =>
                    shownMonth &&
                    setMonth(
                      shownMonth.m === 11
                        ? { y: shownMonth.y + 1, m: 0 }
                        : { y: shownMonth.y, m: shownMonth.m + 1 },
                    )
                  }
                  className="flex size-11 items-center justify-center rounded-full text-ink hover:text-brand-600"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </span>
            </div>
            <div className="mb-1 grid grid-cols-7 text-center text-xs font-bold uppercase text-ink-muted">
              {weekdays.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div role="grid" className="grid grid-cols-7 gap-y-1 text-center">
              {shownMonth &&
                monthGrid(shownMonth.y, shownMonth.m)
                  .flat()
                  .map((cell) => {
                    const ok = cell.inMonth && freeDays.has(cell.date);
                    const selected = cell.date === date;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={!ok}
                        aria-pressed={selected}
                        onClick={() => {
                          setDate(cell.date);
                        }}
                        className={cn(
                          'relative mx-auto flex size-10 items-center justify-center rounded-full text-sm',
                          !cell.inMonth && 'invisible',
                          selected
                            ? 'neu-glow font-bold'
                            : ok
                              ? 'font-bold text-ink hover:bg-brand-500/10'
                              : 'text-ink-muted/40',
                          cell.date === today && !selected && 'ring-2 ring-brand-500/50',
                        )}
                      >
                        {Number(cell.date.slice(8))}
                        {ok && !selected && (
                          <span
                            aria-hidden
                            className="absolute bottom-1 size-1 rounded-full bg-brand-500"
                          />
                        )}
                      </button>
                    );
                  })}
            </div>
            <p className="mt-3 flex items-center gap-2 px-1 text-xs text-ink-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
              {doctor ? t('booking.availableDay') : t('booking.pickDays')}
            </p>
          </section>

          <section
            aria-labelledby="summary"
            className="neu-card rounded-3xl border-4 border-white p-6 sm:p-8"
          >
            <h2 id="summary" className="mb-4 text-xl font-bold text-ink">
              {t('booking.summary')}
            </h2>
            <ul className="mb-6 space-y-3 text-sm font-bold text-ink">
              <li className="flex items-center gap-3">
                <UserRound className="size-5 shrink-0 text-brand-600" aria-hidden />
                {doctor ? (
                  doctor.name
                ) : (
                  <span className="font-medium text-ink-muted">{t('booking.notChosen')}</span>
                )}
              </li>
              <li className="flex items-center gap-3">
                <CalendarDays className="size-5 shrink-0 text-brand-600" aria-hidden />
                {date ? (
                  fmtDate(date, true)
                ) : (
                  <span className="font-medium text-ink-muted">{t('booking.notChosen')}</span>
                )}
              </li>
              <li className="flex items-center gap-3">
                <ClipboardPlus className="size-5 shrink-0 text-brand-600" aria-hidden />
                {typeTitle}
              </li>
            </ul>
            <Button type="button" size="lg" disabled={!canContinue} onClick={next}>
              {t('booking.continue')}
              <ArrowRight className="size-5" aria-hidden />
            </Button>
            <p className="mt-4 text-center text-2xs font-bold uppercase tracking-widest text-ink-muted">
              {t('booking.feeNote')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
