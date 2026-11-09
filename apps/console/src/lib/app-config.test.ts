import { describe, expect, it } from 'vitest';
import { areasOf, homeFor, isWorkspaceType, workspaces, workspaceTypes } from './app-config';

describe('workspaces', () => {
  it('sends each account type to its own dashboard', () => {
    expect(homeFor('clinic')).toBe('/clinic');
    expect(homeFor('lab')).toBe('/lab');
    expect(homeFor('pharmacy')).toBe('/pharmacy');
  });

  it('recognises only the three workspace types', () => {
    for (const t of workspaceTypes) expect(isWorkspaceType(t)).toBe(true);
    expect(isWorkspaceType('admin')).toBe(false);
    expect(isWorkspaceType(undefined)).toBe(false);
  });

  it('keeps every path inside its own workspace, each one unique, with a dashboard first', () => {
    const seen = new Set<string>();
    for (const type of workspaceTypes) {
      const { basePath } = workspaces[type];
      const areas = areasOf(type);
      expect(areas[0]?.key).toBe('dashboard');
      expect(areas[0]?.href).toBe(basePath);
      for (const a of areas) {
        expect(a.href === basePath || a.href.startsWith(basePath + '/')).toBe(true);
        expect(seen.has(a.href)).toBe(false);
        seen.add(a.href);
      }
    }
  });

  it('gives a pharmacy no clinic screens and a lab no pharmacy screens', () => {
    const keys = (t: 'clinic' | 'lab' | 'pharmacy') => areasOf(t).map((a) => a.key);
    expect(keys('pharmacy')).not.toContain('appointments');
    expect(keys('pharmacy')).toContain('orders');
    expect(keys('lab')).not.toContain('orders');
    expect(keys('lab')).toContain('reports');
  });
});
