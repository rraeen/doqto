import { E164, hashSecret, safeEqualHex } from '../crypto';
import { ProviderInputError } from '../errors';
import type { ProviderMode } from '../provider-mode';
import type { SmsProvider } from '../sms/sms.provider';
import type { TemplateKey } from '../whatsapp/templates';
import type { WhatsAppProvider } from '../whatsapp/whatsapp.provider';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  type OtpChallenge,
  type OtpProvider,
  type OtpPurpose,
  type OtpSendRequest,
  type OtpVerifyRequest,
  type OtpVerifyResult,
} from './otp.provider';

const TEMPLATE_BY_PURPOSE: Record<OtpPurpose, TemplateKey> = {
  login: 'otp_login',
  visit: 'otp_visit',
};

/** Shared send/verify flow; subclasses only decide how the code is generated. */
export abstract class BaseOtpProvider implements OtpProvider {
  abstract readonly providerName: string;
  abstract readonly mode: ProviderMode;

  constructor(
    private readonly pepper: string,
    private readonly whatsapp: WhatsAppProvider,
    private readonly sms: SmsProvider,
  ) {}

  protected abstract generateCode(): string;

  hashCode(phone: string, purpose: OtpPurpose, code: string): string {
    return hashSecret(this.pepper, `otp:${purpose}:${phone}`, code);
  }

  async send(request: OtpSendRequest): Promise<OtpChallenge> {
    if (!E164.test(request.phone)) throw new ProviderInputError('OTP phone must be E.164');
    const code = this.generateCode();
    const templateKey = TEMPLATE_BY_PURPOSE[request.purpose];
    const message = { to: request.phone, templateKey, language: request.language, params: [code] };

    let channel: OtpChallenge['channel'] = 'whatsapp';
    let providerMessageId: string;
    try {
      ({ providerMessageId } = await this.whatsapp.sendTemplate(message));
    } catch (whatsappError) {
      // TDD 7: OTPs fall back to SMS when WhatsApp fails.
      channel = 'sms';
      try {
        ({ providerMessageId } = await this.sms.send(message));
      } catch (smsError) {
        throw new AggregateError([whatsappError, smsError], 'OTP could not be delivered', {
          cause: smsError,
        });
      }
    }

    return {
      codeHash: this.hashCode(request.phone, request.purpose, code),
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      channel,
      providerMessageId,
    };
  }

  async verify(request: OtpVerifyRequest): Promise<OtpVerifyResult> {
    const now = request.now ?? new Date();
    if (request.stored.attempts >= OTP_MAX_ATTEMPTS)
      return { ok: false, reason: 'too_many_attempts' };
    if (now.getTime() >= request.stored.expiresAt.getTime())
      return { ok: false, reason: 'expired' };
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(request.code))
      return { ok: false, reason: 'invalid_code' };
    const hash = this.hashCode(request.phone, request.purpose, request.code);
    return safeEqualHex(hash, request.stored.codeHash)
      ? { ok: true }
      : { ok: false, reason: 'invalid_code' };
  }
}
