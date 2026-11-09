'use client';

import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Clock,
  Download,
  Droplet,
  Hash,
  Info,
  LogIn,
  Moon,
  Pill,
  Share2,
  Sun,
  Sunrise,
  UserRound,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import type { AppointmentCardData } from '@/lib/appointments-view';
import { cn } from '@/lib/cn';
import type { DoseTiming, Medicine } from '@/lib/prescription';
import { useAppointments } from './use-appointments';
import { usePrescriptionFile } from './use-prescription-file';

const TIMING: Record<
  DoseTiming,
  { icon: LucideIcon; label: 'afterFood' | 'beforeFood' | 'withWater' | 'anytime' }
> = {
  after_food: { icon: Utensils, label: 'afterFood' },
  before_food: { icon: Utensils, label: 'beforeFood' },
  with_water: { icon: Droplet, label: 'withWater' },
  anytime: { icon: Clock, label: 'anytime' },
};

const SLOTS = [
  { key: 'morning', icon: Sunrise },
  { key: 'noon', icon: Sun },
  { key: 'night', icon: Moon },
] as const;

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-4 py-2 text-sm font-bold text-ink">
      <Icon className="size-4 text-brand-600" aria-hidden />
      {children}
    </span>
  );
}

function MedicineCard({ m }: { m: Medicine }) {
  const { t } = useI18n();
  const timing = TIMING[m.timing];
  return (
    <li className="neu-card rounded-xl p-6">
      <div className="flex flex-col justify-between gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-ink">{m.name}</h3>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ink-muted">
              {m.purpose}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Chip icon={Pill}>{m.dose}</Chip>
            <Chip icon={CalendarRange}>{m.duration}</Chip>
            <Chip icon={timing.icon}>{t(`prescription.${timing.label}`)}</Chip>
          </div>
        </div>
        <div className="neu-inset flex min-w-[240px] flex-col items-center justify-center gap-4 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-tight text-ink-muted">
            {t('prescription.schedule')}
          </p>
          <ul className="flex gap-4">
            {SLOTS.map(({ key, icon: Icon }) => {
              const on = m.schedule[key];
              return (
                <li key={key} className="flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      'flex size-14 items-center justify-center rounded-full',
                      on ? 'neu-glow' : 'neu-inset text-ink-muted opacity-40',
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      'text-2xs font-bold uppercase',
                      on ? 'text-brand-700' : 'text-ink-muted opacity-60',
                    )}
                  >
                    {t(`prescription.${key}`)}
                  </span>
                  <span className="sr-only">{on ? '✓' : '–'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}

function Detail({ a }: { a: AppointmentCardData }) {
  const { t } = useI18n();
  const { rx, when, followUpLabel, download, share } = usePrescriptionFile(a);
  if (!rx) {
    return <EmptyState icon={Pill} title={t('prescription.none')} />;
  }
  return (
    <div className="space-y-10">
      <header className="neu-card flex flex-col items-center gap-8 rounded-xl p-6 sm:p-8 md:flex-row md:items-start">
        <span
          aria-hidden
          className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-brand-500/40 bg-brand-500/10 text-brand-700 sm:size-40"
        >
          <UserRound className="mt-6 size-28" fill="currentColor" strokeWidth={1.2} />
        </span>
        <div className="flex flex-col items-center justify-center text-center md:items-start md:text-left">
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <h1 className="text-3xl font-bold text-ink">{a.doctor.name}</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
              <BadgeCheck className="size-3.5" aria-hidden />
              {t('prescription.verified')}
            </span>
          </div>
          <p className="mt-1 text-lg font-medium text-ink-muted">
            {a.doctor.specialty} • {a.clinic.name}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
            <span className="neu-inset flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold">
              <CalendarDays className="size-4 text-brand-600" aria-hidden />
              {t('prescription.issued', { date: when?.date ?? '' })}
            </span>
            <span className="neu-inset flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold">
              <Hash className="size-4 text-brand-600" aria-hidden />
              {t('prescription.rxNumber', { number: rx.rxNumber })}
            </span>
          </div>
        </div>
      </header>

      <p
        role="note"
        className="rounded-md bg-warning-bg px-4 py-2 text-sm font-medium text-warning"
      >
        {t('prescription.example')}
      </p>

      <section aria-labelledby="meds">
        <div className="mb-6 flex items-center justify-between gap-3 px-2">
          <h2 id="meds" className="flex items-center gap-2 text-xl font-bold text-ink">
            <Pill className="size-5 text-brand-600" aria-hidden />
            {t('prescription.medsTitle')}
          </h2>
          <span className="text-sm font-semibold text-ink-muted">
            {rx.medicines.length === 1
              ? t('prescription.medsCountOne')
              : t('prescription.medsCount', { count: rx.medicines.length })}
          </span>
        </div>
        <ul className="flex flex-col gap-6">
          {rx.medicines.map((m) => (
            <MedicineCard key={m.name} m={m} />
          ))}
        </ul>
      </section>

      {(rx.notes || followUpLabel) && (
        <section aria-labelledby="notes">
          <h2 id="notes" className="mb-4 px-2 text-xl font-bold text-ink">
            {t('prescription.notesTitle')}
          </h2>
          <div className="neu-inset rounded-xl border-l-4 border-brand-500 p-6">
            <div className="flex gap-4">
              <Info className="mt-1 size-5 shrink-0 text-brand-600" aria-hidden />
              <div className="space-y-4">
                {rx.notes && <p className="text-lg font-medium leading-relaxed">“{rx.notes}”</p>}
                {followUpLabel && (
                  <div className="border-t border-line pt-4">
                    <p className="mb-1 text-2xs font-bold uppercase text-ink-muted">
                      {t('prescription.followUp')}
                    </p>
                    <p className="text-sm font-bold">{followUpLabel}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="sm:w-auto sm:px-8"
          onClick={download}
        >
          <Download className="size-5" aria-hidden />
          {t('prescription.download')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="sm:w-auto sm:px-8"
          onClick={() => void share()}
        >
          <Share2 className="size-5" aria-hidden />
          {t('prescription.share')}
        </Button>
      </div>
    </div>
  );
}

export function PrescriptionView({ id }: { id: string }) {
  const { t } = useI18n();
  const { me, all, isPending } = useAppointments();
  const appointment = all.find((x) => x.id === id);

  let body;
  if (isPending) {
    body = (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  } else if (!me.data) {
    body = (
      <EmptyState
        icon={LogIn}
        title={t('prescription.signIn')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/appointments/${id}/prescription`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  } else if (!appointment) {
    body = <EmptyState icon={Pill} title={t('prescription.notFound')} />;
  } else {
    body = <Detail a={appointment} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/appointments"
        className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('prescription.back')}
      </Link>
      {body}
    </div>
  );
}
