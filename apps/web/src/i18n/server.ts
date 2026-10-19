import 'server-only';
import { cookies } from 'next/headers';
import { defaultLocale, getMessages, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { createTranslator } from './translate';

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getTranslator() {
  const locale = await getLocale();
  return { locale, t: createTranslator(getMessages(locale)) };
}
