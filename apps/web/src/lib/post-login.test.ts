import { describe, expect, it } from 'vitest';
import { consoleHome, postLoginPath } from './post-login';

describe('consoleHome', () => {
  it.each([
    [['patient'], null],
    [['patient', 'doctor'], '/clinic'],
    [['clinic_staff'], '/clinic'],
    [['doctor', 'admin'], '/admin'],
  ] as const)('%j -> %s', (roles, expected) => {
    expect(consoleHome(roles)).toBe(expected);
  });
});

describe('postLoginPath', () => {
  const base = { isNewUser: false, next: null, audience: 'patient' } as const;

  it('sends patients home and staff to their console', () => {
    expect(postLoginPath({ ...base, roles: ['patient'] })).toEqual({ path: '/', denied: false });
    expect(postLoginPath({ ...base, roles: ['doctor'] })).toEqual({
      path: '/clinic',
      denied: false,
    });
    expect(postLoginPath({ ...base, roles: ['admin'] })).toEqual({
      path: '/admin',
      denied: false,
    });
  });

  it('keeps a safe next path over the role home', () => {
    expect(postLoginPath({ ...base, roles: ['doctor'], next: '/appointments' }).path).toBe(
      '/appointments',
    );
  });

  it('flags a patient-only account on the clinic sign-in', () => {
    expect(postLoginPath({ ...base, roles: ['patient'], audience: 'clinic' })).toEqual({
      path: '/',
      denied: true,
    });
  });

  it('sends clinic staff to the console from the clinic sign-in', () => {
    expect(postLoginPath({ ...base, roles: ['clinic_staff'], audience: 'clinic' })).toEqual({
      path: '/clinic',
      denied: false,
    });
  });

  it('onboards new users and carries next along', () => {
    expect(postLoginPath({ ...base, roles: ['patient'], isNewUser: true }).path).toBe(
      '/profile?welcome=1',
    );
    expect(
      postLoginPath({ ...base, roles: ['patient'], isNewUser: true, next: '/appointments' }).path,
    ).toBe('/profile?welcome=1&next=%2Fappointments');
  });
});
