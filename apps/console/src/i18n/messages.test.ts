import { describe, expect, it } from 'vitest';
import { areasOf, workspaces, workspaceTypes } from '@/lib/app-config';
import en from './messages/en';
import hi from './messages/hi';
import { createTranslator } from './translate';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v as object, prefix + k + '.'),
  );
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const get = (m: object, key: string) =>
  key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], m) as string;

describe('console messages', () => {
  it('Hindi has every English key and keeps every placeholder', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
    for (const key of keys(en)) {
      expect(placeholders(get(hi, key))).toEqual(placeholders(get(en, key)));
    }
  });

  it('every screen of every workspace has a nav label and a title, and every group a label', () => {
    const t = createTranslator(en);
    for (const type of workspaceTypes) {
      expect(t(('workspaceTypes.' + type) as never)).not.toBe('workspaceTypes.' + type);
      for (const area of areasOf(type)) {
        expect(t(('nav.' + area.key) as never)).not.toBe('nav.' + area.key);
        expect(t(('areas.' + area.key + '.title') as never)).not.toBe(
          'areas.' + area.key + '.title',
        );
      }
      for (const group of workspaces[type].groups) {
        expect(t(group.labelKey as never)).not.toBe(group.labelKey);
      }
    }
  });
});

describe('approval status texts', () => {
  it('every unit status has a label and a hint in both languages', async () => {
    const { UNIT_STATUSES } = await import('@doqto/shared');
    for (const m of [en, hi]) {
      for (const status of UNIT_STATUSES) {
        expect(get(m, 'unitStatus.' + status)).toBeTruthy();
        expect(get(m, 'unitHint.' + status)).toBeTruthy();
      }
    }
  });
});
