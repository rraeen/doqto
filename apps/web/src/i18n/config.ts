import en, { type Messages } from './messages/en';
import hi from './messages/hi';

export const locales = ['en', 'hi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'doqto_lang';

export const localeNames: Record<Locale, string> = { en: 'English', hi: 'हिन्दी' };

const catalogs: Record<Locale, Messages> = { en, hi };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}
