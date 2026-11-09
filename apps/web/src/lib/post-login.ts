import type { Role } from '@doqto/shared';

export type LoginAudience = 'patient' | 'clinic';

/** Where a role lands after signing in, or `null` for a patient-only account. */
export function consoleHome(roles: readonly Role[]): string | null {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('doctor') || roles.includes('clinic_staff')) return '/clinic';
  return null;
}

interface PostLoginInput {
  roles: readonly Role[];
  isNewUser: boolean;
  /** Already passed through `safeNext`. */
  next: string | null;
  audience: LoginAudience;
}

/**
 * Where to send someone after OTP. A safe `next` wins; otherwise staff go to their console and
 * patients to `/`. `denied` is set when the clinic sign-in was used by a patient-only account.
 */
export function postLoginPath({ roles, isNewUser, next, audience }: PostLoginInput): {
  path: string;
  denied: boolean;
} {
  if (isNewUser) {
    return {
      path: `/profile?welcome=1${next ? `&next=${encodeURIComponent(next)}` : ''}`,
      denied: audience === 'clinic',
    };
  }
  const home = consoleHome(roles);
  if (audience === 'clinic' && !home) return { path: '/', denied: true };
  return { path: next ?? home ?? '/', denied: false };
}
