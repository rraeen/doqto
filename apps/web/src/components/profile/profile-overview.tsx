'use client';

import type { Me } from '@doqto/shared';
import {
  BadgeCheck,
  ChevronRight,
  Copy,
  HelpCircle,
  Info,
  LogOut,
  Pencil,
  Settings,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { tabOf } from '@/lib/appointments-view';
import { formatE164ForDisplay } from '@/lib/phone';
import { useLogout } from '@/lib/session';
import { env } from '@/lib/env';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-ink">{children}</dd>
    </div>
  );
}

function MenuItem({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-4 px-4 py-3 font-semibold text-ink transition-colors hover:bg-brand-500/10 sm:px-5"
      >
        <span className="neu-inset flex size-10 shrink-0 items-center justify-center rounded-full text-brand-700">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-2 text-center">
      <p className="text-2xl font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-ink-muted">{label}</p>
    </div>
  );
}

export function ProfileOverview({ me }: { me: Me }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const signOut = useLogout();
  const { all } = useAppointments();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';

  const upcoming = all.filter((a) => tabOf(a.status) === 'upcoming').length;
  const past = all.length - upcoming;
  const shortId = `#${me.id.slice(-8).toUpperCase()}`;
  const since = new Intl.DateTimeFormat(tag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(me.createdAt));

  const logout = () =>
    signOut.mutate(undefined, {
      onSettled: () => {
        toast(t('profile.loggedOut'));
        router.replace('/');
      },
    });

  const copyId = () => {
    void navigator.clipboard
      ?.writeText(shortId)
      .then(() => toast.success(t('profile.idCopied')))
      .catch(() => undefined);
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <section
          className="neu-card rounded-3xl p-5 sm:p-8 sm:text-center"
          // A very light green wash from the top-left corner.
          style={{
            backgroundImage:
              'radial-gradient(120% 90% at 0% 0%, rgba(135, 213, 84, 0.22), rgba(135, 213, 84, 0) 60%)',
          }}
        >
          <div className="flex items-center gap-4 sm:flex-col sm:gap-0">
            <span className="relative block size-20 shrink-0 sm:mx-auto sm:size-32">
              <span
                aria-hidden
                className="flex size-full items-center justify-center overflow-hidden rounded-full border-4 border-brand-500/70 bg-brand-500/10 text-brand-700"
              >
                <UserRound
                  className="mt-3.5 size-14 sm:mt-5 sm:size-24"
                  fill="currentColor"
                  strokeWidth={1.2}
                />
              </span>
              <span
                title={t('profile.mobileVerified')}
                className="neu-glow absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full sm:bottom-0 sm:right-0 sm:size-8"
              >
                <BadgeCheck className="size-4" aria-label={t('profile.mobileVerified')} />
              </span>
            </span>

            <div className="min-w-0 flex-1 sm:mt-4 sm:flex-none">
              <h1 className="break-words text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
                {me.name ?? t('profile.title')}
              </h1>
              <p className="mt-0.5 text-base font-medium text-ink-muted">
                {formatE164ForDisplay(me.phone)}
              </p>
              <button
                type="button"
                onClick={copyId}
                title={t('profile.copyId')}
                className="-ml-1 mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1 text-xs font-semibold tabular-nums text-ink-muted hover:text-ink sm:mx-auto sm:min-h-11 sm:gap-2 sm:px-3"
              >
                {t('profile.idLabel', { id: shortId })}
                <Copy className="size-3.5 text-brand-700" aria-hidden />
                <span className="sr-only">{t('profile.copyId')}</span>
              </button>
            </div>
          </div>

          <div className="neu-inset mt-5 flex items-center rounded-2xl py-3.5 sm:mt-4 sm:py-4">
            <Stat value={upcoming} label={t('profile.upcomingVisits')} />
            <span aria-hidden className="h-10 w-px bg-line" />
            <Stat value={past} label={t('profile.pastVisits')} />
          </div>

          <Link
            href="/profile/edit"
            className={buttonVariants({ size: 'lg', className: 'mt-5 w-full' })}
          >
            <Pencil className="size-5" aria-hidden />
            {!me.name ? t('profile.noName') : t('profile.editProfile')}
          </Link>
        </section>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="text-danger max-lg:hidden"
          loading={signOut.isPending}
          onClick={logout}
        >
          <LogOut className="size-5" aria-hidden />
          {t('profile.logout')}
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="basic" className="neu-card rounded-3xl p-6 sm:p-8">
          <h2 id="basic" className="mb-5 flex items-center gap-3 text-lg font-bold text-ink">
            <Info className="size-5 text-brand-700" aria-hidden />
            {t('profile.basicInfo')}
          </h2>
          <dl className="divide-y divide-line">
            <Row label={t('profile.phoneLabel')}>{formatE164ForDisplay(me.phone)}</Row>
            <Row label={t('profile.languageLabel')}>{locale === 'hi' ? 'हिन्दी' : 'English'}</Row>
            <Row label={t('profile.whatsappLabel')}>
              <span className={me.whatsappOptIn ? 'text-brand-700' : 'text-ink-muted'}>
                {me.whatsappOptIn ? t('profile.whatsappOn') : t('profile.whatsappOff')}
              </span>
            </Row>
            <Row label={t('profile.memberSince')}>{since}</Row>
          </dl>
        </section>

        <ul className="neu-card divide-y divide-line overflow-hidden rounded-3xl">
          <MenuItem href="/install" icon={Smartphone} label={t('profile.installApp')} />
          <MenuItem href="/profile/settings" icon={Settings} label={t('profile.menuSettings')} />
          <MenuItem href="/help" icon={HelpCircle} label={t('profile.menuHelp')} />
          <MenuItem href="/privacy" icon={ShieldCheck} label={t('profile.privacyPolicy')} />
          <MenuItem href={env.consoleUrl} icon={Stethoscope} label={t('profile.doctorLink')} />
        </ul>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="text-danger lg:hidden"
          loading={signOut.isPending}
          onClick={logout}
        >
          <LogOut className="size-5" aria-hidden />
          {t('profile.logout')}
        </Button>
      </div>
    </div>
  );
}
