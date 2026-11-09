'use client';

import { mediaSrc } from '@/lib/media';
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LogIn,
  Search,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PayHold } from './booking-actions';
import { ReviewLink } from '@/components/reviews/review-link';
import { useAppointments } from './use-appointments';
import { usePrescriptionFile } from './use-prescription-file';
import { useWhen } from './use-when';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import {
  STATUS_LABEL,
  STATUS_TONE,
  visibleAppointments,
  type AppointmentCardData,
  type AppointmentTab,
} from '@/lib/appointments-view';
import { cn } from '@/lib/cn';

const appointmentTextLinkClass =
  'inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-bold text-brand-700 underline-offset-4 transition-colors hover:text-brand-600 hover:underline';

function DownloadButton({ a }: { a: AppointmentCardData }) {
  const { t } = useI18n();
  const { rx, download } = usePrescriptionFile(a);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t('appointments.download')}
      title={t('appointments.download')}
      disabled={!rx}
      onClick={download}
    >
      <Download className="size-5" aria-hidden />
    </Button>
  );
}

function AppointmentCard({ a, tab }: { a: AppointmentCardData; tab: AppointmentTab }) {
  const { t } = useI18n();
  const when = useWhen()(a.start);
  return (
    <li className="neu-card flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:contents">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-500 bg-brand-500/10 text-brand-700 sm:size-16"
          >
            {a.doctor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc(a.doctor.photoUrl)} alt="" className="size-full object-cover" />
            ) : (
              <UserRound
                className="mt-1.5 size-8 sm:mt-2 sm:size-11"
                fill="currentColor"
                strokeWidth={1.5}
              />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <h3 className="truncate text-base font-bold text-ink sm:text-lg">{a.doctor.name}</h3>
            <p className="truncate text-sm font-medium text-ink-muted">
              {a.doctor.specialty}
              {a.clinic.name ? ` · ${a.clinic.name}` : ''}
            </p>
            <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm text-ink-muted sm:flex">
              {when && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden />
                  {when.date} · {when.time}
                </span>
              )}
              <Badge tone={STATUS_TONE[a.status]}>
                {a.status === 'completed' && <CheckCircle2 className="size-3.5" aria-hidden />}
                {t(STATUS_LABEL[a.status])}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm sm:hidden">
          {when && (
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-brand-700">
              <CalendarClock className="size-4 shrink-0 text-brand-700" aria-hidden />
              <span className="truncate">
                {when.date} · {when.time}
              </span>
            </span>
          )}
          <Badge tone={STATUS_TONE[a.status]} className="shrink-0">
            {a.status === 'completed' && <CheckCircle2 className="size-3.5" aria-hidden />}
            {t(STATUS_LABEL[a.status])}
          </Badge>
        </div>
        <ReviewLink a={a} />
      </div>
      <div
        className={cn(
          'sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:gap-3',
          a.status === 'completed'
            ? 'grid grid-cols-[1fr_1fr_auto] gap-2.5'
            : 'flex flex-wrap items-center justify-center gap-3 sm:justify-end',
        )}
      >
        {a.status === 'completed' ? (
          <>
            <Link
              href={`/d/${a.doctor.id}`}
              className={buttonVariants({
                variant: 'outline',
                className: 'px-3 text-sm text-brand-700 sm:px-5 sm:text-base',
              })}
            >
              <CalendarClock className="size-4" aria-hidden />
              {t('appointments.reschedule')}
            </Link>
            <Link
              href={`/appointments/${a.id}/prescription`}
              className={buttonVariants({
                variant: 'outline',
                className: 'px-3 text-sm sm:px-5 sm:text-base',
              })}
            >
              <FileText className="size-4" aria-hidden />
              {t('appointments.prescription')}
            </Link>
            <DownloadButton a={a} />
          </>
        ) : (
          <>
            <PayHold a={a} />
            <Link
              href={tab === 'past' ? `/d/${a.doctor.id}` : `/appointments/${a.id}`}
              className={appointmentTextLinkClass}
            >
              {tab === 'past' ? t('appointments.bookAgain') : t('appointments.viewDetails')}
              {tab !== 'past' && <ArrowRight className="size-4 shrink-0" aria-hidden />}
            </Link>
          </>
        )}
      </div>
    </li>
  );
}

function Tabs({
  tab,
  onChange,
  counts,
}: {
  tab: AppointmentTab;
  onChange: (t: AppointmentTab) => void;
  counts: Record<AppointmentTab, number>;
}) {
  const { t } = useI18n();
  const items: Array<{ id: AppointmentTab; label: string }> = [
    { id: 'upcoming', label: t('appointments.tabUpcoming') },
    { id: 'past', label: t('appointments.tabPast') },
  ];
  return (
    <div
      role="tablist"
      aria-label={t('appointments.title')}
      className="neu-inset inline-flex w-full rounded-full p-1.5 sm:w-auto"
    >
      {items.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-colors sm:flex-none sm:px-10',
              active ? 'neu-glow' : 'text-brand-700 hover:text-brand-600',
            )}
          >
            {item.label}
            <span className={cn('text-xs', active ? 'opacity-70' : 'text-ink-muted')}>
              {counts[item.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AppointmentsPage() {
  const { t } = useI18n();
  const { me, all, isPending } = useAppointments();
  const params = useSearchParams();
  const [tabPicked, setTab] = useState<AppointmentTab>('upcoming');
  // `?q=` opens the list already filtered, e.g. by a doctor's id (from the Home page).
  const [search, setSearch] = useState(() => params.get('q') ?? '');

  const counts = {
    upcoming: visibleAppointments(all, 'upcoming', search).length,
    past: visibleAppointments(all, 'past', search).length,
  };
  // A search looks through both tabs: if the open tab has no match but the other one does, show
  // that one instead of an empty list.
  const other: AppointmentTab = tabPicked === 'upcoming' ? 'past' : 'upcoming';
  const tab: AppointmentTab =
    search.trim() && counts[tabPicked] === 0 && counts[other] > 0 ? other : tabPicked;
  const shown = visibleAppointments(all, tab, search);

  let body;
  if (isPending) {
    body = (
      <div className="space-y-5" aria-busy>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (!me.data) {
    body = (
      <EmptyState
        icon={LogIn}
        title={t('appointments.signInBody')}
        action={
          <Link
            href="/login?next=%2Fappointments"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  } else if (shown.length === 0) {
    const searching = search.trim().length > 0;
    body = (
      <EmptyState
        icon={tab === 'upcoming' ? CalendarCheck : CalendarX2}
        title={
          searching
            ? t('appointments.noMatch')
            : tab === 'upcoming'
              ? t('appointments.emptyUpcomingTitle')
              : t('appointments.emptyPastTitle')
        }
        description={
          searching
            ? undefined
            : tab === 'upcoming'
              ? t('appointments.emptyUpcomingBody')
              : t('appointments.emptyPastBody')
        }
        action={
          !searching && tab === 'upcoming' ? (
            <Link
              href="/search"
              className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
            >
              <Search className="size-5" aria-hidden />
              {t('appointments.findDoctor')}
            </Link>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <ul className="space-y-5">
        {shown.map((a) => (
          <AppointmentCard key={a.id} a={a} tab={tab} />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-start md:gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            {t('appointments.title')}
          </h1>
          <Link href="/appointments/new" className={cn(appointmentTextLinkClass, 'shrink-0')}>
            <CalendarPlus className="size-5" aria-hidden />
            {t('booking.bookVisit')}
          </Link>
        </div>
        <label className="neu-inset flex w-full items-center gap-3 rounded-full px-5 py-3 md:max-w-sm">
          <Search className="size-5 shrink-0 text-brand-600" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('appointments.searchLabel')}
            placeholder={t('appointments.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted/60 focus:outline-none"
          />
        </label>
      </div>

      {/* {sample && (
        <p
          role="note"
          className="rounded-md bg-warning-bg px-4 py-2 text-sm font-medium text-warning"
        >
          {t('appointments.sampleNote')}
        </p>
      )} */}

      <Tabs tab={tab} onChange={setTab} counts={counts} />

      <section aria-live="polite" className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
            <Clock className="size-5 text-brand-600" aria-hidden />
            {tab === 'upcoming' ? t('appointments.upcomingHeading') : t('appointments.pastHeading')}
          </h2>
        </div>
        {body}
      </section>
    </div>
  );
}
