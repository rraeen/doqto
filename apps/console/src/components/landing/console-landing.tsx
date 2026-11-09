import { buttonVariants } from '@doqto/ui/button';
import { Logo } from '@doqto/ui/logo';
import { StatusChip } from '@doqto/ui/status-chip';
import {
  BadgeCheck,
  CalendarCheck,
  FlaskConical,
  ListOrdered,
  Pill,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslator } from '@/i18n/server';
import { loginPath, registerPath } from '@/lib/app-config';
import { env } from '@/lib/env';
import { LanguageSwitch } from '../shell/language-switch';

/**
 * Public front page of the console, for providers only. Patients land on the patient site; the
 * patient site's "for doctors" links bring providers here.
 */
export async function ConsoleLanding() {
  const { t } = await getTranslator();
  const who = [
    {
      icon: Stethoscope,
      title: t('landing.clinicTitle'),
      body: t('landing.clinicBody'),
      later: false,
    },
    { icon: FlaskConical, title: t('landing.labTitle'), body: t('landing.labBody'), later: true },
    { icon: Pill, title: t('landing.pharmacyTitle'), body: t('landing.pharmacyBody'), later: true },
  ];
  const features = [
    { icon: BadgeCheck, title: t('landing.f1Title'), body: t('landing.f1Body') },
    { icon: CalendarCheck, title: t('landing.f2Title'), body: t('landing.f2Body') },
    { icon: ListOrdered, title: t('landing.f3Title'), body: t('landing.f3Body') },
    { icon: Users, title: t('landing.f4Title'), body: t('landing.f4Body') },
    { icon: Star, title: t('landing.f5Title'), body: t('landing.f5Body') },
  ];
  const steps = [t('landing.step1'), t('landing.step2'), t('landing.step3'), t('landing.step4')];

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Doqto Console" className="flex items-center gap-2">
            <Logo />
            <span className="hidden text-sm font-semibold text-ink-muted sm:inline">Console</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-muted md:flex">
            <a href="#who" className="hover:text-ink">
              {t('landing.navWho')}
            </a>
            <a href="#features" className="hover:text-ink">
              {t('landing.navFeatures')}
            </a>
            <a href="#how" className="hover:text-ink">
              {t('landing.navHow')}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Link href={loginPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {t('landing.ctaLogin')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <StatusChip tone="info">{t('landing.badge')}</StatusChip>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold text-ink sm:text-5xl">
            {t('landing.title1')} <span className="text-brand-700">{t('landing.title2')}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">{t('landing.body')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={registerPath} className={buttonVariants({ size: 'md' })}>
              {t('landing.ctaRegister')}
            </Link>
            <Link href={loginPath} className={buttonVariants({ variant: 'outline', size: 'md' })}>
              {t('landing.ctaLogin')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-muted">{t('landing.soon')}</p>
        </section>

        <section id="who" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-14 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-ink">{t('landing.whoTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {who.map(({ icon: Icon, title, body, later }) => (
              <div key={title} className="rounded-sm border border-line bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {later && <StatusChip>{t('landing.comingLater')}</StatusChip>}
                </div>
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-y border-line bg-white py-14">
          <div className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
            <h2 className="mb-6 text-2xl font-bold text-ink">{t('landing.featuresTitle')}</h2>
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-0.5 text-sm text-ink-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-ink">{t('landing.howTitle')}</h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step} className="rounded-sm border border-line bg-white p-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col gap-4 rounded-sm border border-line bg-white p-6 sm:flex-row sm:items-center">
            <ShieldCheck className="size-10 shrink-0 text-brand-700" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-ink">{t('landing.trustTitle')}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t('landing.trustBody')}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-ink-muted sm:px-6">
          <p>
            {t('landing.patientHint')}{' '}
            <a className="font-semibold text-brand-700 hover:underline" href={env.siteUrl}>
              {t('landing.patientLink')}
            </a>
          </p>
          <a className="hover:text-ink" href={env.siteUrl + '/privacy'}>
            {t('landing.privacy')}
          </a>
        </div>
      </footer>
    </div>
  );
}
