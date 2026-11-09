import { createServerI18n } from '@doqto/i18n/server';
import { defaultLocale, getMessages, isLocale, LOCALE_COOKIE } from './config';

export const { getLocale, getTranslator } = createServerI18n({
  cookieName: LOCALE_COOKIE,
  defaultLocale,
  isLocale,
  getMessages,
});
