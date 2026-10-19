import { randomNumericCode } from '../crypto';
import { BaseOtpProvider } from './base-otp.provider';
import { OTP_LENGTH } from './otp.provider';

/**
 * Live mode: random 6-digit code, delivered over WhatsApp with SMS fallback.
 * Until the live WhatsApp and MSG91 adapters land (INT-20) both channels
 * throw ProviderNotConfiguredError, so send() fails loudly.
 */
export class LiveOtpProvider extends BaseOtpProvider {
  readonly providerName = 'live-otp';
  readonly mode = 'live' as const;

  protected generateCode(): string {
    return randomNumericCode(OTP_LENGTH);
  }
}
