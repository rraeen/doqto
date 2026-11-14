import { PERMISSIONS_BY_KIND } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import {
  AREA_PERMISSION,
  allowedAreas,
  areaAt,
  areasOf,
  canOpenArea,
  homeFor,
  isWorkspaceType,
  workspaces,
  workspaceTypes,
} from './app-config';

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

describe('what a staff member may open', () => {
  const owner = { role: 'owner' as const, permissions: [] };
  const staff = (...permissions: string[]) => ({ role: 'staff' as const, permissions });
  const keys = (type: 'clinic' | 'lab' | 'pharmacy', m: Parameters<typeof allowedAreas>[1]) =>
    allowedAreas(type, m).map((a) => a.key);

  it('lets the owner open everything', () => {
    for (const type of workspaceTypes) {
      expect(allowedAreas(type, owner)).toEqual(areasOf(type));
    }
  });

  it('gives staff the dashboard and only the screens that were switched on', () => {
    expect(keys('clinic', staff())).toEqual(['dashboard']);
    expect(keys('clinic', staff('queue', 'messages'))).toEqual(['dashboard', 'queue', 'messages']);
    expect(keys('lab', staff('bookings', 'collection'))).toEqual([
      'dashboard',
      'labBookings',
      'collection',
    ]);
  });

  it('never gives staff the staff, profile or settings screens, whatever they are granted', () => {
    const everything = staff(...PERMISSIONS_BY_KIND.clinic, 'owner', 'staff', 'profile', 'settings');
    for (const k of ['staff', 'profile', 'settings'] as const) {
      expect(canOpenArea(k, everything)).toBe(false);
    }
  });

  it('asks for a permission that the owner can actually grant on every screen', () => {
    for (const type of workspaceTypes) {
      const grantable: readonly string[] = PERMISSIONS_BY_KIND[type];
      for (const a of areasOf(type)) {
        const need = AREA_PERMISSION[a.key];
        if (need !== null && need !== 'owner') expect(grantable).toContain(need);
      }
    }
  });

  it('finds the screen a path belongs to', () => {
    expect(areaAt('clinic', '/clinic')?.key).toBe('dashboard');
    expect(areaAt('clinic', '/clinic/queue')?.key).toBe('queue');
    expect(areaAt('clinic', '/clinic/queue/')?.key).toBe('queue');
    expect(areaAt('lab', '/lab/bookings/abc')?.key).toBe('labBookings');
    expect(areaAt('lab', '/lab/unknown')).toBeUndefined();
  });
});
