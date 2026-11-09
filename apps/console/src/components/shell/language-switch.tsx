'use client';

import { cn } from '@doqto/ui/cn';
import { localeNames, locales } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';

export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t('common.language')} className="flex items-center gap-1">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          onClick={() => setLocale(l)}
          className={cn(
            'h-8 rounded-sm px-2 text-xs font-semibold transition-colors',
            l === locale
              ? 'bg-brand-500 text-ink'
              : dark
                ? 'text-white/70 hover:bg-white/10'
                : 'text-ink-muted hover:bg-surface',
          )}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
