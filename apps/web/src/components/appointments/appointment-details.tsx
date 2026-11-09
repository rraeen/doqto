'use client';

import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  Info,
  LogIn,
  MapPin,
  MessageCircle,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { STATUS_LABEL, STATUS_TONE, type AppointmentCardData } from '@/lib/appointments-view';
import { formatRupees } from '@/lib/money';
import { appointmentReference } from '@doqto/shared';
import { ReviewLink } from '@/components/reviews/review-link';
import { CancelButton, PayHold, feeOf } from './booking-actions';
import { ChangeTimeSheet } from './change-time-sheet';
import { useAppointments } from './use-appointments';
import { useWhen } from './use-when';

/** Statuses for which the clinic's front desk will ask for the visit code. */
const SHOWS_CODE = new Set(['confirmed', 'checked_in', 'in_consult']);
/** Once the doctor has accepted the booking the patient can message them (a week after the visit too). */
const CAN_MESSAGE = new Set(['confirmed', 'checked_in', 'in_consult', 'completed']);

function VisitCode({ a, reference }: { a: AppointmentCardData; reference: string }) {
  const { t } = useI18n();
  const code = a.visitCode ?? null;

  return (
    <section aria-labelledby="visit-code" className="neu-card rounded-3xl p-5 text-center sm:p-7">
      <h2 id="visit-code" className="text-xs font-bold uppercase tracking-widest text-ink-muted">
        {t('appointments.visitCodeTitle')}
      </h2>
      {code ? (
        <>
          <p aria-label={code.split('').join(' ')} className="mt-3 flex justify-center gap-3">
            {code.split('').map((d, i) => (
              <span
                key={i}
                className="neu-inset flex size-14 items-center justify-center rounded-2xl text-3xl font-bold text-ink sm:size-16"
              >
                {d}
              </span>
            ))}
          </p>
          <p className="mt-4 text-sm font-semibold text-ink-muted">
            {t('appointments.appointmentId')}:{' '}
            <span className="tabular-nums text-ink">{reference}</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">{t('appointments.visitCodeHint')}</p>
        </>
      ) : (
        <p className="mt-3 flex items-start gap-2 text-left text-sm text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          {t('appointments.visitCodeMissing')}
        </p>
      )}
    </section>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
      <span className="min-w-0 font-semibold text-ink">{children}</span>
    </li>
  );
}

export function AppointmentDetails({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const { me, all, isPending } = useAppointments();
  const whenOf = useWhen();
  const a = all.find((x) => x.id === id);

  if (isPending) {
    return (
      <div className="space-y-5" aria-busy>
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('appointments.signInBody')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/appointments/${id}`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  if (!a) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t('appointments.detailsNotFound')}
        action={
          <Link
            href="/appointments"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('appointments.backToList')}
          </Link>
        }
      />
    );
  }

  const when = whenOf(a.start);
  const upcoming =
    a.status === 'pending_payment' ||
    a.status === 'pending_confirmation' ||
    a.status === 'confirmed';
  const reference = appointmentReference(a.id);
  const fee = formatRupees(feeOf(a), tag);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/appointments"
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('appointments.backToList')}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {t('appointments.detailsTitle')}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Badge tone={STATUS_TONE[a.status]}>{t(STATUS_LABEL[a.status])}</Badge>
          <p className="text-sm font-semibold text-ink-muted">
            {t('appointments.appointmentId')}:{' '}
            <span className="tabular-nums text-ink">{reference}</span>
          </p>
        </div>
      </header>

      {a.status === 'pending_payment' && (
        <section
          aria-labelledby="pay-title"
          className="neu-card space-y-3 rounded-3xl border-2 border-warning/40 p-5 sm:p-7"
        >
          <h2 id="pay-title" className="text-lg font-bold text-ink">
            {t('appointments.payTitle')}
          </h2>
          <p className="text-sm text-ink-muted">{t('appointments.payBody', { fee })}</p>
          <PayHold a={a} />
        </section>
      )}

      {a.status === 'pending_confirmation' && (
        <section aria-labelledby="wait-title" className="neu-card space-y-3 rounded-3xl p-5 sm:p-7">
          <h2 id="wait-title" className="text-lg font-bold text-ink">
            {t('appointments.waitingTitle')}
          </h2>
          <p className="text-sm text-ink-muted">{t('appointments.waitingBody')}</p>
        </section>
      )}

      {SHOWS_CODE.has(a.status) && <VisitCode a={a} reference={reference} />}

      <section
        aria-label={t('appointments.detailsTitle')}
        className="neu-card rounded-3xl p-5 sm:p-7"
      >
        <ul className="divide-y divide-line">
          <Row icon={UserRound}>{a.doctor.name}</Row>
          <Row icon={Stethoscope}>{a.doctor.specialty}</Row>
          {when && (
            <Row icon={CalendarClock}>
              {when.date} · {when.time}
            </Row>
          )}
          {(a.clinic.name || a.clinic.area) && (
            <Row icon={MapPin}>{[a.clinic.name, a.clinic.area].filter(Boolean).join(', ')}</Row>
          )}
        </ul>
      </section>

      {a.api && CAN_MESSAGE.has(a.status) && (
        <Link
          href={`/consult/${a.id}`}
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}
        >
          <MessageCircle className="size-5" aria-hidden />
          {t('appointments.messageDoctor')}
        </Link>
      )}

      {a.status === 'completed' && <ReviewLink a={a} large />}

      {upcoming && (
        <div className="grid grid-cols-2 gap-3">
          <ChangeTimeSheet a={a} className="w-full px-3" />
          <CancelButton a={a} className="w-full px-3 text-danger" />
        </div>
      )}

      <Link
        href={`/d/${a.doctor.id}`}
        className="flex min-h-11 items-center justify-center font-semibold text-brand-700 hover:underline"
      >
        {t('appointments.viewDoctor')}
      </Link>
    </div>
  );
}
