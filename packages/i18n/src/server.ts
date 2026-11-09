import 'server-only';
import { cookies } from 'next/headers';
import { createTranslator, type Translate } from './translate';

export interface ServerI18nConfig<L extends string, M> {
  cookieName: string;
  defaultLocale: L;
  isLocale: (value: unknown) => value is L;
  getMessages: (locale: L) => M;
}

/** Reads the visitor's language cookie on the server and returns the matching translator. */
export function createServerI18n<L extends string, M>(config: ServerI18nConfig<L, M>) {
  async function getLocale(): Promise<L> {
    const value = (await cookies()).get(config.cookieName)?.value;
    return config.isLocale(value) ? value : config.defaultLocale;
  }

  async function getTranslator(): Promise<{ locale: L; t: Translate<M> }> {
    const locale = await getLocale();
    return { locale, t: createTranslator(config.getMessages(locale)) };
  }

  return { getLocale, getTranslator };
}
