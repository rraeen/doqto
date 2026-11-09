'use client';

import { createI18nContext } from '@doqto/i18n/client';
import { LOCALE_COOKIE, type Locale } from './config';
import type { Messages } from './messages/en';

export const { I18nProvider, useI18n, useT } = createI18nContext<Locale, Messages>(LOCALE_COOKIE);
