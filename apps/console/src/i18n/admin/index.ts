'use client';

import { createTranslator, type Translate } from '@doqto/i18n';
import { useMemo } from 'react';
import { useI18n as useConsoleI18n } from '../provider';
import en, { type Messages } from './en';
import hi from './hi';

/**
 * The admin area has its own texts (staff screens) on top of the console's language choice: one
 * language switch for the whole app, two catalogs. Admin components import `useT` and `useI18n`
 * from here instead of from `@/i18n/provider`.
 */
export type AdminMessages = Messages;
export type AdminTranslate = Translate<Messages>;

export function useI18n(): { t: AdminTranslate; locale: 'en' | 'hi' } {
  const { locale } = useConsoleI18n();
  const t = useMemo(() => createTranslator<Messages>(locale === 'hi' ? hi : en), [locale]);
  return { t, locale };
}

export const useT = (): AdminTranslate => useI18n().t;
