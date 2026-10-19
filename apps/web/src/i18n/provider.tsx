'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { LOCALE_COOKIE, type Locale } from './config';
import type { Messages } from './messages/en';
import { createTranslator, type Translate } from './translate';

interface I18nValue {
  locale: Locale;
  t: Translate;
  /** Persists the choice in a cookie and re-renders server components in the new language. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useMemo(() => createTranslator(messages), [messages]);
  const setLocale = useCallback(
    (next: Locale) => {
      writeLocaleCookie(next);
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );
  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}
