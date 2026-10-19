import { hashSecret, randomNumericCode, safeEqualHex } from '../crypto';
import type { ProviderMode } from '../provider-mode';
import { DEMO_FIXED_OTP } from './demo-otp.provider';

/** DB doc 3.6 `appointments.visitCode`: 4 digits, stored hashed, locked after 5 wrong tries for 15 min (BE-16). */
export const VISIT_CODE_LENGTH = 4;
export const VISIT_CODE_MAX_ATTEMPTS = 5;
export const VISIT_CODE_LOCK_MINUTES = 15;
const VISIT_CODE_PATTERN = new RegExp(`^\\d{${VISIT_CODE_LENGTH}}$`);

export interface IssuedVisitCode {
  /** Shown once to the patient (confirmation screen and WhatsApp), never stored. */
  code: string;
  hash: string;
}

/**
 * Visit codes prove a real visit (TDD 5.1). The code is random in every mode;
 * in demo mode check-in additionally accepts 123456 (TDD 13), decided only by
 * PROVIDER_MODE at startup. Bound as VISIT_CODES; BE-27 issues, BE-16 checks
 * and owns attempts and lockout.
 */
export class VisitCodes {
  constructor(
    private readonly pepper: string,
    readonly mode: ProviderMode,
  ) {}

  issue(appointmentId: string): IssuedVisitCode {
    const code = randomNumericCode(VISIT_CODE_LENGTH);
    return { code, hash: this.hash(appointmentId, code) };
  }

  matches(appointmentId: string, code: string, storedHash: string): boolean {
    if (this.mode === 'demo' && code === DEMO_FIXED_OTP) return true;
    if (!VISIT_CODE_PATTERN.test(code)) return false;
    return safeEqualHex(this.hash(appointmentId, code), storedHash);
  }

  private hash(appointmentId: string, code: string): string {
    return hashSecret(this.pepper, `visit-code:${appointmentId}`, code);
  }
}
