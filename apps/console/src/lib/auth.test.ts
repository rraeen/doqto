import { ApiError } from '@doqto/api-client';
import { describe, expect, it } from 'vitest';
import {
  authErrorKey,
  isStrongPassword,
  isValidIdentifier,
  landingFor,
  landingForAccount,
  normalizeIdentifier,
} from './auth';

describe('normalizeIdentifier', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['  Dr.Rao@Example.COM ', 'dr.rao@example.com'],
  ])('%s -> %s', (raw, expected) => expect(normalizeIdentifier(raw)).toBe(expected));

  it('leaves anything else for the form to reject', () => {
    expect(isValidIdentifier(normalizeIdentifier('12345'))).toBe(false);
    expect(isValidIdentifier(normalizeIdentifier('5876543210'))).toBe(false);
    expect(isValidIdentifier(normalizeIdentifier('name@'))).toBe(false);
    expect(isValidIdentifier(normalizeIdentifier('9876543210'))).toBe(true);
    expect(isValidIdentifier(normalizeIdentifier('a@b.in'))).toBe(true);
  });
});

describe('isStrongPassword', () => {
  it('needs 10 characters with a letter and a number', () => {
    expect(isStrongPassword('short1')).toBe(false);
    expect(isStrongPassword('onlyletterslong')).toBe(false);
    expect(isStrongPassword('1234567890123')).toBe(false);
    expect(isStrongPassword('Sunrise2026x')).toBe(true);
  });
});

describe('authErrorKey', () => {
  const err = (status: number, code: ConstructorParameters<typeof ApiError>[1], details = {}) =>
    new ApiError(status, code, 'x', details);

  it('maps contract error codes to messages', () => {
    expect(authErrorKey(err(401, 'INVALID_CREDENTIALS'))).toBe('authError.invalidCredentials');
    expect(authErrorKey(err(409, 'CONFLICT'))).toBe('authError.exists');
    expect(authErrorKey(err(400, 'OTP_INVALID', { attemptsLeft: 3 }))).toBe('authError.otpInvalid');
    expect(authErrorKey(err(400, 'OTP_LOCKED'))).toBe('authError.otpLocked');
    expect(authErrorKey(err(403, 'ACCOUNT_SUSPENDED'))).toBe('authError.suspended');
  });

  it('tells a sign-in lock (minutes) from a short rate limit', () => {
    expect(authErrorKey(err(429, 'RATE_LIMITED', { retryAfterSeconds: 880 }))).toBe('authError.locked');
    expect(authErrorKey(err(429, 'RATE_LIMITED', { retryAfterSeconds: 30 }))).toBe('authError.rate');
  });

  it('falls back to a generic message', () => {
    expect(authErrorKey(new Error('boom'))).toBe('authError.generic');
  });
});

describe('landingFor', () => {
  const ws = (
    kind: 'clinic' | 'lab' | 'pharmacy',
    status: 'pending' | 'verified' | 'changes_requested' = 'verified',
  ) => ({
    id: 'a'.repeat(24),
    organizationId: 'b'.repeat(24),
    kind,
    name: 'Rao',
    status,
    role: 'owner' as const,
    reviewNote: null,
  });

  it('goes straight to the dashboard when exactly one service is approved', () => {
    expect(landingFor([ws('lab')])).toBe('/lab');
    expect(landingFor([ws('pharmacy'), ws('clinic', 'pending')])).toBe('/pharmacy');
  });

  it('shows the panel when nothing is approved yet, or several services are', () => {
    expect(landingFor([])).toBe('/services');
    expect(landingFor([ws('clinic', 'pending')])).toBe('/services');
    expect(landingFor([ws('lab', 'changes_requested')])).toBe('/services');
    expect(landingFor([ws('clinic'), ws('lab')])).toBe('/services');
  });
});

describe('landingForAccount', () => {
  it('sends the Doqto team to the admin area and everyone else by their services', () => {
    expect(landingForAccount({ platformRole: 'admin', workspaces: [] })).toBe('/admin');
    expect(landingForAccount({ platformRole: null, workspaces: [] })).toBe('/services');
    expect(
      landingForAccount({
        platformRole: null,
        workspaces: [
          { id: 'a'.repeat(24), organizationId: 'b'.repeat(24), kind: 'lab', name: 'Rao', status: 'verified', role: 'owner', reviewNote: null },
        ],
      }),
    ).toBe('/lab');
  });
});
