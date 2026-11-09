'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type Translate } from './translate';

export interface I18nValue<L extends string, M> {
  locale: L;
  t: Translate<M>;
  /** Persists the choice in a cookie and re-renders server components in the new language. */
  setLocale: (locale: L) => void;
}

/**
 * Builds the provider and hooks for one app. Call it once, in a client module, with the app's
 * locale type, its message type and its cookie name:
 *
 *   export const { I18nProvider, useI18n, useT } = createI18nContext<Locale, Messages>('doqto_lang');
 */
export function createI18nContext<L extends string, M>(cookieName: string) {
  const Context = createContext<I18nValue<L, M> | null>(null);

  function writeLocaleCookie(locale: L) {
    document.cookie = `${cookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }

  function I18nProvider({
    locale,
    messages,
    children,
  }: {
    locale: L;
    messages: M;
    children: ReactNode;
  }) {
    const router = useRouter();
    const t = useMemo(() => createTranslator(messages), [messages]);
    const setLocale = useCallback(
      (next: L) => {
        writeLocaleCookie(next);
        document.documentElement.lang = next;
        router.refresh();
      },
      [router],
    );
    const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useI18n(): I18nValue<L, M> {
    const ctx = useContext(Context);
    if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
    return ctx;
  }

  function useT(): Translate<M> {
    return useI18n().t;
  }

  return { I18nProvider, useI18n, useT, writeLocaleCookie };
}
