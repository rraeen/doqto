import type { MessageLanguage } from '../messaging.types';
import type { ProviderInfo } from '../provider-mode';

/** `login` for phone sign-in, `visit` for walk-in check-in at the clinic (INT-08). */
export type OtpPurpose = 'login' | 'visit';

/** TDD 11: 6 digits, 5-minute expiry, 5 verify attempts. */
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpSendRequest {
  /** E.164 phone. */
  phone: string;
  purpose: OtpPurpose;
  language: MessageLanguage;
}

/**
 * What the caller stores in the `otps` row. The plain code never leaves the
 * provider; only its peppered hash does.
 */
export interface OtpChallenge {
  codeHash: string;
  expiresAt: Date;
  channel: 'whatsapp' | 'sms';
  providerMessageId: string;
}

/** The `otps` row as the caller stored it. */
export interface StoredOtp {
  codeHash: string;
  expiresAt: Date;
  /** Wrong attempts so far. The caller increments it when verify returns `invalid_code`. */
  attempts: number;
}

export interface OtpVerifyRequest {
  phone: string;
  purpose: OtpPurpose;
  code: string;
  stored: StoredOtp;
  now?: Date;
}

export type OtpVerifyResult =
  { ok: true } | { ok: false; reason: 'expired' | 'too_many_attempts' | 'invalid_code' };

/**
 * Generates and delivers one-time codes and checks them. Expiry and the
 * attempt limit are enforced here identically in demo and live, so demo
 * mode behaves exactly like live apart from the code itself.
 */
export interface OtpProvider extends ProviderInfo {
  send(request: OtpSendRequest): Promise<OtpChallenge>;
  verify(request: OtpVerifyRequest): Promise<OtpVerifyResult>;
}
