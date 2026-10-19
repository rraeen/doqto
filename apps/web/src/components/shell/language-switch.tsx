'use client';

import type { Me } from '@doqto/shared';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { authApi } from '@/lib/api/lazy';
import { meQueryKey } from '@/lib/session';
import { localeNames, locales, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Switches the UI language. The choice is kept in a cookie for everyone and,
 * for a signed-in user, saved to their account with `PATCH /me`.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const qc = useQueryClient();

  const change = (next: Locale) => {
    setLocale(next);
    const me = qc.getQueryData<Me | null>(meQueryKey);
    if (!me || me.language === next) return;
    authApi
      .updateMe({ language: next })
      .then((updated) => qc.setQueryData(meQueryKey, updated))
      .catch(() => toast.error(t('common.somethingWrong')));
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={cn('inline-flex rounded-md bg-canvas p-0.5 ring-1 ring-line', className)}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          onClick={() => {
            if (l !== locale) change(l);
          }}
          className={cn(
            'h-8 rounded-[5px] px-3 text-sm font-medium',
            l === locale ? 'bg-surface text-brand-700 shadow-xs' : 'text-ink-muted',
          )}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
