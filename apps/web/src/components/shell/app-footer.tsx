'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/provider';
import { env } from '@/lib/env';

const linkClass =
  'inline-flex min-h-9 items-center text-sm font-semibold text-ink-muted transition-colors hover:text-brand-600';

export function AppFooter() {
  const { t } = useI18n();
  const pathname = usePathname();
  const year = new Date().getFullYear();

  // A conversation is a full-height chat: no footer under the composer.
  if (/^\/consult\/[^/]+/.test(pathname)) return null;

  return (
    <footer className="hidden border-t border-line bg-surface/80 md:block">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold text-ink">{t('common.appName')}</p>
          <p className="text-sm text-ink-muted">{t('appFooter.copyright', { year })}</p>
          <p className="text-xs leading-relaxed text-ink-subtle">{t('appFooter.tagline')}</p>
        </div>
        <nav
          aria-label={t('appFooter.navLabel')}
          className="flex flex-wrap gap-x-6 gap-y-2 lg:justify-end"
        >
          <Link href="/help" className={linkClass}>
            {t('appFooter.help')}
          </Link>
          <Link href={env.consoleUrl} className={linkClass}>
            {t('appFooter.forDoctors')}
          </Link>
          <Link href="/install" className={linkClass}>
            {t('appFooter.install')}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {t('appFooter.privacy')}
          </Link>
          <Link href="/transparency" className={linkClass}>
            {t('appFooter.transparency')}
          </Link>
          <Link href="/help" className={linkClass}>
            {t('appFooter.terms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
