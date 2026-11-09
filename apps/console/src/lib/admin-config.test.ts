import { describe, expect, it } from 'vitest';
import { areas, isProviderKind, providerKinds } from './admin-config';

describe('admin navigation', () => {
  it('has a list screen for every provider type', () => {
    for (const kind of providerKinds) {
      expect(areas.some((a) => a.key === kind && a.href === '/admin/' + kind)).toBe(true);
    }
  });

  it('puts registration requests right after the dashboard', () => {
    expect(areas[0]?.key).toBe('dashboard');
    expect(areas[1]?.key).toBe('requests');
  });

  it('recognises only the four provider types', () => {
    expect(isProviderKind('labs')).toBe(true);
    expect(isProviderKind('users')).toBe(false);
  });
});
