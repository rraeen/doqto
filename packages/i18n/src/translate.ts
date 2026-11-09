type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Dotted path to every string in a message catalog, e.g. `auth.resendIn`. */
export type MessageKey<M> = Leaves<M>;
export type TranslateParams = Record<string, string | number>;
export type Translate<M> = (key: MessageKey<M>, params?: TranslateParams) => string;

/**
 * Looks a key up in the catalog and fills `{name}` placeholders. A missing key returns the key
 * itself, so a gap shows up on screen instead of crashing the page.
 */
export function createTranslator<M>(messages: M): Translate<M> {
  return (key, params) => {
    let node: unknown = messages;
    for (const part of String(key).split('.'))
      node = (node as Record<string, unknown> | undefined)?.[part];
    const text = typeof node === 'string' ? node : key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
