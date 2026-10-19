import { BaseOtpProvider } from './base-otp.provider';

/**
 * TDD 13: the only demo code. It is a constant, not configuration, so no
 * request header, query flag or env value can change it at runtime.
 */
export const DEMO_FIXED_OTP = '123456';

/**
 * Demo mode: every OTP is 123456. The caller still stores the hashed row and
 * the provider still applies expiry and the 5-attempt limit, so the flow is
 * identical to live. Delivery goes through the (demo) WhatsApp provider,
 * which records the message without any network call.
 */
export class DemoOtpProvider extends BaseOtpProvider {
  readonly providerName = 'demo-otp';
  readonly mode = 'demo' as const;

  protected generateCode(): string {
    return DEMO_FIXED_OTP;
  }
}
