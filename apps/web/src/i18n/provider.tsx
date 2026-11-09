'use client';

import { createI18nContext } from '@doqto/i18n/client';
import { LOCALE_COOKIE, type Locale } from './config';
import type { Messages } from './messages/en';

// The provider and hooks come from `@doqto/i18n`; this app supplies its locales and catalogs.
export const { I18nProvider, useI18n, useT, writeLocaleCookie } = createI18nContext<
  Locale,
  Messages
>(LOCALE_COOKIE);
