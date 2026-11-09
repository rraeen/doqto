import {
  CalendarCheck,
  Check,
  Radio,
  Search,
  ShieldCheck,
  Stethoscope,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { OTP_LENGTH } from '@doqto/shared';
import { LoginModal } from '@/components/auth/login-modal';
import { LanguagePrompt } from './language-prompt';
import { PublicFooter, PublicNav } from './public-nav';
import { buttonVariants } from '@/components/ui/button';
import { getTranslator } from '@/i18n/server';
import { cn } from '@/lib/cn';

function IconDisc({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        'neu-inset flex size-16 items-center justify-center rounded-full text-brand-600',
        className,
      )}
    >
      <Icon className="size-7 transition-transform group-hover:scale-110" aria-hidden />
    </span>
  );
}

const wide = 'w-auto px-10 text-lg';

export async function LandingPage() {
  const { t } = await getTranslator();

  const features = [
    { icon: Radio, title: t('landing.f1Title'), body: t('landing.f1Body') },
    { icon: CalendarCheck, title: t('landing.f2Title'), body: t('landing.f2Body') },
    { icon: ShieldCheck, title: t('landing.f3Title'), body: t('landing.f3Body') },
  ];
  const audiences = [
    { label: t('landing.audDoctors'), body: t('landing.audDoctorsBody') },
    { label: t('landing.audPatients'), body: t('landing.audPatientsBody') },
    { label: t('landing.audClinics'), body: t('landing.audClinicsBody') },
  ];
  const steps = [
    { icon: Search, title: t('landing.step1'), body: t('landing.step1Body') },
    { icon: CalendarCheck, title: t('landing.step2'), body: t('landing.step2Body') },
    { icon: Star, title: t('landing.step3'), body: t('landing.step3Body') },
  ];
  const queueBars = ['h-[40%]', 'h-[60%]', 'h-[80%]', 'h-[50%]', 'h-[70%]', 'h-[30%]'];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <PublicNav />
      <LanguagePrompt />

      <main className="flex flex-1 flex-col items-center">
        <section className="grid w-full max-w-[1100px] items-center gap-16 px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:grid-cols-2 lg:pt-32">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="neu-inset w-fit rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-600">
                {t('landing.badge')}
              </span>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                {t('landing.heroTitle1')}
                <br />
                <span className="text-brand-600">{t('landing.heroTitle2')}</span>
              </h1>
              <p className="max-w-[520px] text-lg font-medium leading-relaxed text-ink-muted md:text-xl">
                {t('landing.heroBody')}
              </p>
            </div>
            <div className="flex flex-wrap gap-5">
              <LoginModal
                otpLength={OTP_LENGTH}
                next="/search"
                className={buttonVariants({ size: 'lg', className: wide })}
              >
                {t('landing.cta')}
              </LoginModal>
              <a
                href="#how"
                className={buttonVariants({ variant: 'outline', size: 'lg', className: wide })}
              >
                {t('landing.heroSecondary')}
              </a>
            </div>
          </div>

          <div
            aria-hidden
            className="neu-card relative flex flex-col gap-6 overflow-hidden rounded-xl p-6 sm:p-8"
          >
            <span className="absolute right-4 top-4 rounded-full bg-brand-500/10 px-3 py-1 text-2xs font-bold uppercase tracking-wider text-brand-700">
              {t('landing.example')}
            </span>
            <div className="neu-raised flex w-full max-w-[290px] flex-col gap-3 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-tight text-ink-muted">
                  {t('landing.mockLive')}
                </span>
                <span className="size-2 animate-pulse rounded-full bg-brand-500" />
              </div>
              <p className="text-lg font-bold text-ink">{t('landing.mockDoctor')}</p>
              <p className="flex items-center gap-2 text-sm font-bold text-brand-700">
                <Check className="size-4" />
                {t('landing.mockInClinic')}
              </p>
              <p className="text-xs text-ink-muted">{t('landing.mockUpdated')}</p>
            </div>
            <div className="neu-inset flex w-full max-w-[270px] flex-col gap-2 self-end rounded-lg p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                  <CalendarCheck className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">
                    {t('landing.mockSlot')}
                  </p>
                  <p className="text-sm font-extrabold text-ink">{t('landing.mockSlotValue')}</p>
                </div>
              </div>
              <p className="mt-1 text-2xs font-bold text-brand-700">
                {t('landing.mockQueue')}: {t('landing.mockQueueValue')}
              </p>
            </div>
            <div className="neu-raised -mt-2 flex w-full max-w-[250px] items-center gap-4 rounded-lg p-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-500/20 text-brand-600">
                <Star className="size-5" />
              </span>
              <div>
                <p className="text-2xs font-bold uppercase text-ink-muted">
                  {t('landing.mockReview')}
                </p>
                <p className="text-xs font-extrabold text-ink">{t('landing.mockReviewValue')}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="why"
          className="flex w-full justify-center px-4 py-12 sm:px-6 sm:py-16 lg:py-24"
        >
          <div className="flex w-full max-w-[1100px] flex-col gap-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight text-ink">
                {t('landing.whyTitle')}
              </h2>
              <p className="max-w-[600px] text-lg text-ink-muted">{t('landing.whySub')}</p>
            </div>
            <ul className="grid gap-10 md:grid-cols-3">
              {features.map((f) => (
                <li
                  key={f.title}
                  className="neu-card group flex flex-col gap-6 rounded-xl p-10 transition-transform duration-300 hover:-translate-y-2"
                >
                  <IconDisc icon={f.icon} />
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xl font-extrabold text-ink">{f.title}</h3>
                    <p className="font-medium leading-relaxed text-ink-muted">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="grid gap-8 md:grid-cols-3">
              {audiences.map((a) => (
                <li key={a.label} className="neu-inset flex flex-col gap-2 rounded-xl p-8">
                  <span className="text-sm font-bold uppercase tracking-wider text-brand-600">
                    {a.label}
                  </span>
                  <p className="text-lg font-bold text-ink">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how"
          className="flex w-full flex-col items-center gap-20 px-4 py-12 sm:px-6 sm:py-16"
        >
          <div className="w-full max-w-[1100px]">
            <h2 className="mb-12 text-center text-4xl font-extrabold tracking-tight text-ink">
              {t('landing.howTitle')}
            </h2>
            <ol className="neu-card rounded-3xl p-5 md:hidden">
              {steps.map((s, i) => {
                const last = i === steps.length - 1;
                return (
                  <li key={s.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex size-12 shrink-0 items-center justify-center rounded-full',
                          i === 0 ? 'neu-glow' : 'neu-inset text-brand-600',
                        )}
                      >
                        <s.icon className="size-5" aria-hidden />
                      </span>
                      {!last && (
                        <span
                          aria-hidden
                          className="my-1 w-0.5 flex-1 rounded-full bg-brand-500/40"
                        />
                      )}
                    </div>
                    <div className={cn('min-w-0 flex-1 pt-1', !last && 'pb-6')}>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                        {t('landing.stepLabel', { n: i + 1 })}
                      </p>
                      <h3 className="mt-0.5 text-lg font-bold leading-snug text-ink">{s.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <ol className="neu-card hidden items-center justify-between gap-6 rounded-full p-8 md:flex">
              {steps.map((s, i) => (
                <li key={s.title} className="contents">
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        'flex size-12 items-center justify-center rounded-full font-bold',
                        i === 0 ? 'neu-glow' : 'neu-inset text-brand-600',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xl font-bold text-ink">{s.title}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <span aria-hidden className="mx-4 h-px flex-1 bg-brand-500/30" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="neu-inset flex w-full max-w-[1100px] flex-col items-center gap-12 rounded-xl p-8 md:flex-row md:p-12">
            <div className="flex flex-1 flex-col gap-6">
              <h2 className="text-3xl font-extrabold leading-tight text-ink">
                {t('landing.glanceTitle')}
              </h2>
              <p className="text-lg font-medium text-ink-muted">{t('landing.glanceBody')}</p>
              <dl className="flex gap-6">
                <div className="flex flex-col gap-1">
                  <dt className="order-2 text-xs font-bold uppercase text-ink-muted">
                    {t('landing.glanceStat1Label')}
                  </dt>
                  <dd className="text-2xl font-bold text-brand-600">{t('landing.glanceStat1')}</dd>
                </div>
                <span aria-hidden className="h-10 w-px self-center bg-line" />
                <div className="flex flex-col gap-1">
                  <dt className="order-2 text-xs font-bold uppercase text-ink-muted">
                    {t('landing.glanceStat2Label')}
                  </dt>
                  <dd className="text-2xl font-bold text-brand-600">{t('landing.glanceStat2')}</dd>
                </div>
              </dl>
            </div>
            <div aria-hidden className="neu-raised w-full flex-1 rounded-lg p-6">
              <p className="mb-4 text-sm font-bold text-ink-muted">{t('landing.glanceChart')}</p>
              <div className="flex h-32 items-end justify-between gap-2">
                {queueBars.map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-full rounded-t-full',
                      h,
                      i === 3 ? 'bg-brand-500' : 'bg-brand-500/30',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <p className="flex items-center gap-2 px-4 py-10 text-center text-sm font-bold text-ink-muted">
          <Stethoscope className="size-4 text-brand-600" aria-hidden />
          {t('landing.fairness')}
        </p>

        <section className="flex w-full justify-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="neu-card flex w-full max-w-[1100px] flex-col items-center gap-8 rounded-[3rem] p-10 text-center sm:p-16">
            <h2 className="text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
              {t('landing.ctaTitle')}
            </h2>
            <LoginModal
              otpLength={OTP_LENGTH}
              next="/search"
              className={buttonVariants({ size: 'lg', className: 'w-auto px-12 text-xl' })}
            >
              {t('landing.cta')}
            </LoginModal>
            <p className="text-lg font-bold text-ink-muted">{t('landing.ctaTag')}</p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
