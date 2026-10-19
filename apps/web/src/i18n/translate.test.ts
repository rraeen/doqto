import { describe, expect, it } from 'vitest';
import en from './messages/en';
import hi from './messages/hi';
import { createTranslator } from './translate';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

describe('translator', () => {
  it('interpolates params', () => {
    const t = createTranslator(en);
    expect(t('auth.resendIn', { seconds: 30 })).toBe('Resend code in 30s');
  });

  it('falls back to the key for a missing message', () => {
    const t = createTranslator({
      ...en,
      auth: { ...en.auth, verify: undefined as unknown as string },
    });
    expect(t('auth.verify')).toBe('auth.verify');
  });

  it('Hindi has every English key and keeps every placeholder', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
    const tEn = createTranslator(en);
    const tHi = createTranslator(hi);
    for (const key of keys(en)) {
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      // @ts-expect-error iterating runtime keys
      expect(placeholders(tHi(key))).toEqual(placeholders(tEn(key)));
    }
  });
});
