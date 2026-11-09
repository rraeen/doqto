'use client';

import type { Me } from '@doqto/shared';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { authApi } from '@/lib/api/lazy';
import { meQueryKey } from '@/lib/session';
import { localeNames, localeShort, locales, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Switches the UI language. The choice is kept in a cookie for everyone and,
 * for a signed-in user, saved to their account with `PATCH /me`.
 */
export function LanguageSwitch({
  className,
  compact,
}: {
  className?: string;
  /** Show EN / हि instead of the full names. */
  compact?: boolean;
}) {
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
      className={cn('neu-inset inline-flex rounded-full p-1', className)}
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
            'h-10 rounded-full text-sm font-medium',
            compact ? 'min-w-10 px-2.5' : 'px-4',
            l === locale ? 'neu-raised font-bold text-brand-700' : 'text-ink-muted',
          )}
        >
          {compact ? localeShort[l] : localeNames[l]}
        </button>
      ))}
    </div>
  );
}
