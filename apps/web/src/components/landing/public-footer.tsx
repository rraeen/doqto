import Link from 'next/link';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { Logo } from '@/components/shell/logo';
import { getTranslator } from '@/i18n/server';
import { env } from '@/lib/env';

const link =
  'inline-flex min-h-10 items-center text-sm font-semibold text-ink-muted transition-colors hover:text-brand-700 md:min-h-9';

function Group({
  title,
  links,
  className,
  rowOnPhone,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
  className?: string;
  /** Phones: show the links side by side instead of stacked. */
  rowOnPhone?: boolean;
}) {
  return (
    <nav aria-label={title} className={className}>
      <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-ink">{title}</h2>
      <ul className={rowOnPhone ? 'flex flex-wrap gap-x-6 md:block' : undefined}>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={link}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Footer for the landing page and the public pages: brand, grouped links, language, copyright. */
export async function PublicFooter() {
  const { t } = await getTranslator();
  return (
    <footer className="w-full border-t border-line px-4 pb-8 pt-12 sm:px-6 md:pt-14">
      <div className="mx-auto grid w-full max-w-[1100px] gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-8">
        <div className="space-y-3 text-center md:text-left">
          <Link href="/" aria-label="Doqto" className="inline-flex">
            <Logo />
          </Link>
          <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-ink-muted md:mx-0">
            {t('appFooter.tagline')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:col-span-3 md:grid-cols-3 md:gap-8">
          <Group
            title={t('landing.footerPatients')}
            links={[
              { href: '/search', label: t('landing.cta') },
              { href: '/#how', label: t('landing.navHow') },
              { href: '/install', label: t('landing.navApp') },
              { href: '/help', label: t('appFooter.help') },
            ]}
          />
          <Group
            title={t('landing.footerDoctors')}
            links={[
              { href: env.consoleUrl, label: t('landing.navConsole') },
              { href: env.consoleUrl + '/register', label: t('landing.connect') },
            ]}
          />
          <Group
            className="col-span-2 md:col-span-1"
            rowOnPhone
            title={t('landing.footerCompany')}
            links={[
              { href: '/privacy', label: t('landing.privacy') },
              { href: '/transparency', label: t('landing.transparency') },
              { href: '/login', label: t('landing.login') },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-[1100px] flex-col items-center gap-4 border-t border-line pt-6 md:flex-row md:justify-between">
        <LanguageSwitch className="md:order-2" />
        <p className="text-center text-xs font-semibold text-ink-muted md:order-1">
          {t('landing.rights')}
        </p>
      </div>
    </footer>
  );
}
