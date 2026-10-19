import type { Messages } from './messages/en';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export function createTranslator(messages: Messages): Translate {
  return (key, params) => {
    let node: unknown = messages;
    for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
    const text = typeof node === 'string' ? node : key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
