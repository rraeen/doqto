import { OTP_LENGTH } from '@doqto/shared';
import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { LoginModal } from '@/components/auth/login-modal';
import { Logo } from '@/components/shell/logo';
import { NavInstall } from './nav-install';
import { NavMenu } from './nav-menu';
import { PublicNavShell } from './public-nav-shell';
import { getTranslator } from '@/i18n/server';
import { env } from '@/lib/env';

/** Floating pill nav on the landing page. The console link goes to the provider console. */
export async function PublicNav() {
  const { t } = await getTranslator();
  const links = [
    { href: '/#why', label: t('landing.navWhy') },
    { href: '/#how', label: t('landing.navHow') },
    { href: env.consoleUrl, label: t('landing.navConsole') },
  ];
  const control = 'flex h-10 items-center justify-center rounded-full text-sm font-bold';
  return (
    <PublicNavShell>
      <Link href="/" aria-label="Doqto" className="pl-2 sm:pl-0">
        <Logo />
      </Link>
      <nav aria-label="Primary" className="hidden items-center justify-center gap-8 md:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-semibold text-ink hover:text-brand-600"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="col-start-3 flex items-center justify-end gap-2 sm:gap-3 md:col-start-auto">
        {/* On phones the language is chosen on the first visit and changed from the footer. */}
        {/* <LanguageSwitch compact className="hidden md:inline-flex" /> */}
        <LoginModal
          otpLength={OTP_LENGTH}
          className={`${control} neu-inset gap-1.5 px-3 text-ink-muted hover:text-brand-600 sm:gap-2 sm:px-5`}
        >
          <UserRound className="size-4 shrink-0" aria-hidden />
          {t('landing.login')}
        </LoginModal>
        <NavInstall
          installLabel={t('landing.installNow')}
          findLabel={t('landing.cta')}
          className={`${control} neu-glow hidden px-6 font-extrabold hover:brightness-110 lg:flex`}
        />
        <NavMenu
          label={t('landing.menu')}
          items={[
            ...links,
            { href: '/install', label: t('landing.installNow'), primary: true, install: true },
          ]}
          findLabel={t('landing.cta')}
        />
      </div>
    </PublicNavShell>
  );
}

export { PublicFooter } from './public-footer';
