import { describe, expect, it } from 'vitest';
import { areas, groups } from '@/lib/admin-config';
import en from './admin/en';
import hi from './admin/hi';
import { createTranslator } from '@doqto/i18n';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('admin messages (console)', () => {
  it('Hindi has every English key and keeps every placeholder', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
    for (const key of keys(en)) {
      const get = (m: object) =>
        key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], m) as string;
      expect(placeholders(get(hi))).toEqual(placeholders(get(en)));
    }
  });

  it('every screen has a nav label and a title, and every group has a label', () => {
    const t = createTranslator(en);
    for (const area of areas) {
      expect(t(`nav.${area.key}` as never)).not.toBe(`nav.${area.key}`);
      expect(t(`areas.${area.key}.title` as never)).not.toBe(`areas.${area.key}.title`);
    }
    for (const group of groups) expect(t(group.labelKey as never)).not.toBe(group.labelKey);
  });

  it('keeps every path under the app base and every path unique', () => {
    const hrefs = areas.map((a) => a.href);
    expect(hrefs.every((h) => h.startsWith('/admin'))).toBe(true);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
