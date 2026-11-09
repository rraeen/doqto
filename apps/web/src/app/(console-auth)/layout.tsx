import { Stethoscope } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { getTranslator } from '@/i18n/server';

/** Doctor and clinic sign-in shell. Deliberately separate from the patient `(auth)` shell. */
export default async function ConsoleAuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getTranslator();
  const link = 'text-sm font-semibold text-ink hover:text-brand-600';
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        href="/for-doctors"
        badge={
          <span className="neu-inset hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 sm:flex">
            <Stethoscope className="size-3.5" aria-hidden />
            {t('consoleLogin.badge')}
          </span>
        }
        center={
          <nav aria-label="Primary" className="flex items-center gap-8">
            <Link href="/" className={link}>
              {t('consoleLogin.home')}
            </Link>
            <Link href="/for-doctors" className={link}>
              {t('consoleLogin.about')}
            </Link>
          </nav>
        }
        right={<LanguageSwitch compact />}
      />
      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-8">
        {children}
      </div>
      <p className="px-4 pb-24 text-center text-xs font-medium text-ink-muted sm:pb-8">
        {t('consoleLogin.note')}
      </p>
    </div>
  );
}
