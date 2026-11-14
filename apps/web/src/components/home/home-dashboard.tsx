'use client';

import { mediaSrc } from '@/lib/media';
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock,
  FileText,
  FlaskConical,
  LayoutGrid,
  Lightbulb,
  MapPin,
  MessageCircle,
  Pill,
  Radio,
  ArrowRight,
  Search,
  ShieldCheck,
  Stethoscope,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { SPECIALTIES, doctorReference } from '@doqto/shared';
import { Children, useMemo, useState, type ReactNode } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { useWhen } from '@/components/appointments/use-when';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import {
  STATUS_LABEL,
  STATUS_TONE,
  latestBookedFirst,
  visibleAppointments,
  type AppointmentCardData,
} from '@/lib/appointments-view';
import { istSlotOf } from '@/lib/availability';
import { addDays, todayIst } from '@/lib/booking';
import { BOOKING_CITY, useBookableDoctors } from '@/lib/bookable-doctors';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/use-now';

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink sm:mb-5 sm:text-xl">
      <Icon className="size-5 text-brand-600" aria-hidden />
      {children}
    </h2>
  );
}

function IconBubble({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600',
        className,
      )}
    >
      <Icon className="size-6" aria-hidden />
    </span>
  );
}

const QUEUE_PREVIEW: Partial<Record<AppointmentCardData['status'], string>> = {
  confirmed: '04',
  checked_in: '04',
  in_consult: '03',
};

const nextVisitCardShell = 'h-full w-full lg:flex lg:min-h-0 lg:flex-1 lg:flex-col';

/** Matches `neu-card` default (`--radius-xl`) for search, tiles, and inset panels on home. */
const homeSurfaceRadius = 'rounded-xl';

const nextVisitActionClass = cn(
  'neu-inset inline-flex h-tap w-full select-none items-center justify-center gap-2 px-3 text-sm font-bold whitespace-nowrap text-brand-700 sm:text-base transition-[box-shadow,filter] hover:brightness-[0.98] active:scale-[0.98] active:shadow-[inset_7px_7px_14px_#bcc7bc,inset_-7px_-7px_14px_#ffffff]',
  homeSurfaceRadius,
);

const nextVisitPrimaryActionClass = cn(
  'inline-flex h-tap w-full select-none items-center justify-center gap-2 bg-brand-700 px-3 text-sm font-extrabold whitespace-nowrap text-white sm:text-base shadow-[4px_4px_12px_rgb(8_122_8/0.25)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]',
  homeSurfaceRadius,
);

/** Soft green corner glow — aligned with `body::before` and the mobile home bar. */
function NextVisitCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('neu-card relative overflow-hidden', nextVisitCardShell, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(22rem_16rem_at_0%_0%,rgb(210_243_210/0.95)_0%,transparent_62%),radial-gradient(18rem_14rem_at_100%_0%,rgb(193_230_163/0.4)_0%,transparent_52%),radial-gradient(16rem_12rem_at_100%_100%,rgb(135_213_84/0.14)_0%,transparent_58%)]"
      />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Your soonest upcoming visit, or a prompt to book one. */
function NextVisit({ visit, now }: { visit: AppointmentCardData | undefined; now: number }) {
  const { t } = useI18n();
  const when = useWhen();
  if (!visit) {
    return (
      <NextVisitCard className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-600 to-brand-700 shadow-md"
          >
            <Stethoscope className="size-9 text-white" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-ink">{t('home.noVisit')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('home.noVisitBody')}</p>
          </div>
        </div>
        <Link
          href="/appointments/new"
          className={buttonVariants({ size: 'lg', className: 'mt-5 gap-2 lg:mt-auto' })}
        >
          <CalendarPlus className="size-5" aria-hidden />
          {t('home.qaBook')}
        </Link>
      </NextVisitCard>
    );
  }

  const slot = visit.start ? istSlotOf(visit.start) : null;
  const today = todayIst(now);
  const lead = !slot
    ? ''
    : slot.day === today
      ? t('home.today')
      : slot.day === addDays(today, 1)
        ? t('home.tomorrow')
        : (when(visit.start)?.date ?? '');
  const time = when(visit.start)?.time;
  const whenLine = [lead, time].filter(Boolean).join(' • ');
  const queuePosition = QUEUE_PREVIEW[visit.status];
  const statusTone = STATUS_TONE[visit.status];

  return (
    <NextVisitCard className="p-4 sm:p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wide',
            statusTone === 'success' && 'bg-brand-50 text-brand-700 ring-1 ring-brand-500/25',
            statusTone === 'warning' && 'bg-warning-bg text-warning ring-1 ring-warning/20',
            statusTone === 'info' && 'bg-info-bg text-info ring-1 ring-info/20',
            statusTone === 'danger' && 'bg-danger-bg text-danger ring-1 ring-danger/20',
          )}
        >
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              statusTone === 'success' && 'bg-brand-500',
              statusTone === 'warning' && 'bg-warning',
              statusTone === 'info' && 'bg-info',
              statusTone === 'danger' && 'bg-danger',
            )}
            aria-hidden
          />
          {t(STATUS_LABEL[visit.status])}
        </span>
        {whenLine && (
          <span className="text-right text-sm font-semibold text-ink-muted">{whenLine}</span>
        )}
      </div>

      <div className="mt-4 flex gap-3 sm:items-center sm:gap-4 lg:mt-5">
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="flex size-[4.25rem] items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-brand-600 to-brand-700 shadow-[4px_4px_12px_rgb(8_122_8/0.25)] sm:size-20"
          >
            {visit.doctor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaSrc(visit.doctor.photoUrl)}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Stethoscope className="size-8 text-white sm:size-9" strokeWidth={1.75} />
            )}
          </span>
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface bg-brand-500"
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-2xs font-bold uppercase tracking-wider text-brand-600">
            {visit.doctor.specialty}
          </p>
          <p className="mt-0.5 truncate text-lg font-bold text-ink sm:text-xl">
            {visit.doctor.name}
          </p>
          {visit.clinic.name && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{visit.clinic.name}</span>
              </span>
              {queuePosition && (
                <Badge tone="brand" className="px-2.5 py-1 text-xs font-bold">
                  {t('home.queueNext', { position: queuePosition })}
                </Badge>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 lg:block" aria-hidden />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-5">
        <Link
          href={`/appointments?q=${encodeURIComponent(visit.doctor.id)}`}
          className={nextVisitPrimaryActionClass}
        >
          <Ticket className="size-5 shrink-0" aria-hidden />
          {t('home.viewDetails')}
        </Link>
        <Link href="/consult" className={nextVisitActionClass}>
          <MessageCircle className="size-5 shrink-0" aria-hidden />
          {t('home.messageDoctor')}
        </Link>
      </div>
    </NextVisitCard>
  );
}

/**
 * Several cards in a row: each one is as wide as a single card was, so it fits the screen, and the
 * row scrolls sideways one card at a time with dots underneath to show where you are.
 */
function Scroller({ label, children }: { label: string; children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const count = Children.count(children);
  return (
    <div className="space-y-3">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          // One step is a card's width plus the 16px gap.
          const card = el.firstElementChild as HTMLElement | null;
          if (card) setIndex(Math.round(el.scrollLeft / (card.offsetWidth + 16)));
        }}
        className="-mx-4 -mb-4 -mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-8 pt-4 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)] sm:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-6 lg:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {count > 1 && (
        <div aria-hidden className="flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-brand-600' : 'w-1.5 bg-line',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The latest booked visit; with more than one, a row that scrolls to the right. */
function NextVisits({ visits, now }: { visits: AppointmentCardData[]; now: number }) {
  const { t } = useI18n();
  if (visits.length === 0) return <NearbyDoctors />;
  if (visits.length === 1) return <NextVisit visit={visits[0]} now={now} />;
  return (
    <Scroller label={t('home.nextVisitTitle')}>
      {visits.map((v) => (
        <div key={v.id} className="flex w-full shrink-0 snap-start">
          <NextVisit visit={v} now={now} />
        </div>
      ))}
    </Scroller>
  );
}

/** Same shuffle for the same seed, so a re-render does not reorder the cards. */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  const out = [...list];
  let s = Math.floor(seed * 2 ** 31) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** With nothing booked: a few doctors in the pilot city, chosen at random each visit. */
function NearbyDoctors() {
  const { t, locale } = useI18n();
  const { doctors, isPending } = useBookableDoctors();
  const [seed] = useState(() => Math.random());
  const picked = useMemo(() => shuffled(doctors, seed).slice(0, 3), [doctors, seed]);
  const label = (keys: string[]) =>
    keys.map((k) => SPECIALTIES.find((s) => s.key === k)?.[locale] ?? k).join(', ');

  if (isPending) return <Skeleton className="h-56 w-full rounded-xl" aria-busy />;
  if (picked.length === 0) return <NextVisit visit={undefined} now={0} />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{t('home.nearbyHint', { city: BOOKING_CITY })}</p>
      <Scroller label={t('home.nearbyTitle')}>
        {picked.map((d) => (
          <div key={d.id} className="flex w-full shrink-0 snap-start">
            <NextVisitCard className="p-4 sm:p-5 lg:p-6">
              <div className="flex gap-3 sm:items-center sm:gap-4">
                <span
                  aria-hidden
                  className="flex size-[4.25rem] shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-600 to-brand-700 shadow-[4px_4px_12px_rgb(8_122_8/0.25)] sm:size-20"
                >
                  <Stethoscope className="size-8 text-white sm:size-9" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-bold uppercase tracking-wider text-brand-600">
                    {label(d.specialties)}
                  </p>
                  <p className="mt-0.5 truncate text-lg font-bold text-ink sm:text-xl">{d.name}</p>
                  <p className="text-2xs font-semibold text-ink-muted">
                    {t('doctorPage.doctorId')}: {doctorReference(d.id)}
                  </p>
                  {d.primaryClinic && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{d.primaryClinic.name}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-5">
                <Link href={`/d/${d.id}`} className={nextVisitPrimaryActionClass}>
                  <Ticket className="size-5 shrink-0" aria-hidden />
                  {t('home.viewDetails')}
                </Link>
                <Link
                  href={`/appointments/new?doctor=${encodeURIComponent(d.id)}`}
                  className={nextVisitActionClass}
                >
                  <CalendarPlus className="size-5 shrink-0" aria-hidden />
                  {t('search.book')}
                </Link>
              </div>
            </NextVisitCard>
          </div>
        ))}
      </Scroller>
    </div>
  );
}

function Reminder({
  tone,
  icon: Icon,
  title,
  body,
  meta,
}: {
  tone: 'brand' | 'info';
  icon: LucideIcon;
  title: string;
  body: string;
  meta: string;
}) {
  const brand = tone === 'brand';
  return (
    <li
      className={cn(
        'neu-card flex gap-4 border-l-4 p-4 sm:p-5',
        brand ? 'border-brand-500' : 'border-info',
        'lg:min-h-0 lg:flex-1',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md',
          brand ? 'bg-brand-500/10 text-brand-600' : 'bg-info/10 text-info',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{body}</p>
        <p className={cn('mt-2 text-xs font-bold', brand ? 'text-brand-700' : 'text-info')}>
          {meta}
        </p>
      </div>
    </li>
  );
}

function useGreeting(name: string | undefined) {
  const { t } = useI18n();
  const now = useNow();
  if (!name) return t('home.greetingGuest');
  // IST hour, so the greeting matches the time where the patient is.
  const hour = now > 0 ? new Date(now + 5.5 * 3600_000).getUTCHours() : 9;
  const key =
    hour < 12
      ? 'home.greetingMorning'
      : hour < 17
        ? 'home.greetingAfternoon'
        : 'home.greetingEvening';
  return t(key, { name });
}

export function HomeDashboard() {
  const { t } = useI18n();
  const { me, all } = useAppointments();
  const now = useNow();
  const name = me.data?.name?.trim() || undefined;
  const greeting = useGreeting(name);

  const upcoming = latestBookedFirst(visibleAppointments(all, 'upcoming', ''));

  const quick = [
    { href: '/appointments/new', label: t('home.qaBook'), icon: CalendarPlus },
    { href: '/appointments', label: t('home.qaAppointments'), icon: CalendarDays },
    { href: '/consult', label: t('home.qaTalkShort'), icon: MessageCircle },
    { href: '/records', label: t('home.qaRecords'), icon: FileText },
    { href: '/labs', label: t('home.qaLab'), icon: FlaskConical },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-2 sm:px-6 md:pt-6">
      <div className="mb-5 sm:mb-6">
        {me.isPending ? (
          <Skeleton className="h-10 w-64" />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{greeting}</h1>
        )}
        <p className="mt-1 text-base font-medium text-brand-700 sm:text-lg">
          {t('home.greetingSub')}
        </p>
      </div>

      <form
        action="/search"
        role="search"
        className={cn(
          'neu-inset mb-8 flex items-center gap-2 py-2.5 pl-4 pr-2.5 sm:mb-10 sm:gap-3 sm:px-6 sm:py-3',
          homeSurfaceRadius,
        )}
      >
        <Search
          className="size-4 shrink-0 text-ink-muted sm:size-6 sm:text-brand-600"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          aria-label={t('home.searchLabel')}
          placeholder={t('home.searchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink placeholder:text-ink-muted/60 focus:outline-none"
        />
        <button
          type="submit"
          className={cn(
            'neu-glow inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-bold hover:brightness-110 sm:px-5',
            homeSurfaceRadius,
          )}
        >
          <span className="sm:hidden">{t('home.findDoctors')}</span>
          <span className="hidden sm:inline">{t('home.findDoctorFull')}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </button>
      </form>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 sm:gap-10 lg:grid-cols-3 lg:items-stretch">
        <section
          aria-labelledby="next-visit"
          className="flex min-h-0 flex-col lg:col-span-2 lg:col-start-1 lg:row-start-1"
        >
          <h2 id="next-visit" className="sr-only">
            {t('home.nextVisitTitle')}
          </h2>
          <SectionTitle icon={CalendarClock}>
            {upcoming.length > 0 ? t('home.nextVisitTitle') : t('home.nearbyTitle')}
          </SectionTitle>
          <div className="flex min-h-0 flex-1 flex-col">
            <NextVisits visits={upcoming} now={now} />
          </div>
        </section>

        <section
          aria-labelledby="quick-actions"
          className="lg:col-span-2 lg:col-start-1 lg:row-start-2"
        >
          <h2 id="quick-actions" className="sr-only">
            {t('home.quickTitle')}
          </h2>
          <SectionTitle icon={LayoutGrid}>{t('home.quickTitle')}</SectionTitle>
          <ul className="grid grid-cols-5 gap-1.5 sm:gap-4">
            {quick.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="group flex flex-col items-center gap-2.5 text-center sm:gap-3"
                >
                  <span
                    className={cn(
                      'neu-raised flex size-14 items-center justify-center text-brand-600 transition-all group-hover:bg-brand-500/10 group-active:shadow-[inset_4px_4px_8px_#bcc7bc,inset_-4px_-4px_8px_#ffffff] sm:size-24',
                      homeSurfaceRadius,
                    )}
                  >
                    <q.icon className="size-7 sm:size-9" aria-hidden />
                  </span>
                  <span className="text-xs font-bold leading-tight text-ink sm:text-sm">
                    {q.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="reminders"
          className="flex min-h-0 flex-col lg:col-start-3 lg:row-start-1"
        >
          <h2 id="reminders" className="sr-only">
            {t('home.remindersTitle')}
          </h2>
          <SectionTitle icon={BellRing}>{t('home.remindersTitle')}</SectionTitle>
          <ul className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-stretch lg:gap-4 lg:space-y-0">
            <Reminder
              tone="info"
              icon={Pill}
              title={t('home.remMedTitle')}
              body={t('home.remMedBody')}
              meta={t('home.remMedMeta')}
            />
            {upcoming.length === 0 && (
              <Reminder
                tone="brand"
                icon={CalendarClock}
                title={t('home.remApptTitle')}
                body={t('home.remApptBody')}
                meta={t('home.remApptMeta')}
              />
            )}
            <Reminder
              tone="brand"
              icon={Bell}
              title={t('home.remDelayTitle')}
              body={t('home.remDelayBody')}
              meta={t('home.remDelayMeta')}
            />
          </ul>
        </section>

        <section
          aria-labelledby="why-doqto"
          className="lg:col-span-2 lg:col-start-1 lg:row-start-3"
        >
          <h2 id="why-doqto" className="sr-only">
            {t('home.whyTitle')}
          </h2>
          <SectionTitle icon={ShieldCheck}>{t('home.whyTitle')}</SectionTitle>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="neu-card flex items-start gap-4 p-5 sm:block sm:p-6">
              <IconBubble icon={Radio} className="sm:mb-4" />
              <div>
                <p className="font-bold text-ink">{t('home.liveTitle')}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t('home.liveBody')}</p>
              </div>
            </div>
            <div className="neu-card flex items-start gap-4 p-5 sm:block sm:p-6">
              <IconBubble icon={ShieldCheck} className="sm:mb-4" />
              <div>
                <p className="font-bold text-ink">{t('home.reviewsTitle')}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {t('home.reviewsBody')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tip-of-day"
          className="lg:col-start-3 lg:row-span-2 lg:row-start-2 lg:flex lg:flex-col"
        >
          <h2 id="tip-of-day" className="sr-only">
            {t('home.tipTitle')}
          </h2>
          <SectionTitle icon={Lightbulb}>{t('home.tipTitle')}</SectionTitle>
          <div className="neu-card flex flex-col overflow-hidden border-l-4 border-brand-500 lg:min-h-0 lg:flex-1">
            <div
              className="relative flex min-h-36 items-center justify-center overflow-hidden bg-linear-to-br from-brand-100 via-brand-50/90 to-surface sm:min-h-40 lg:min-h-0 lg:flex-1"
              aria-hidden
            >
              <div className="absolute -left-10 top-6 size-36 rounded-full bg-brand-200/50 blur-2xl" />
              <div className="absolute -right-6 bottom-4 size-28 rounded-full bg-brand-500/15 blur-xl" />
              <Clock className="absolute left-[12%] top-[22%] size-7 text-brand-600/25 sm:size-8" />
              <MapPin className="absolute bottom-[20%] right-[14%] size-7 text-brand-600/25 sm:size-8" />
              <span className="relative flex size-20 items-center justify-center rounded-lg bg-surface/90 shadow-md ring-1 ring-brand-500/10 sm:size-24">
                <Lightbulb className="size-10 text-brand-600 sm:size-11" strokeWidth={1.75} />
              </span>
            </div>
            <div className="border-t border-line/60 p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-ink-muted lg:text-base">
                {t('home.tipBody')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
