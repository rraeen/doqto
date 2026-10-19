import { OTP_MAX_ATTEMPTS, type OtpPurpose } from '@doqto/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { scrubPersonalData } from '../common/logging/scrub';
import { OTP_PROVIDER, type OtpProvider } from '../integrations';
import type { MessageLanguage } from '../integrations';
import { Otp } from './otp.schema';

export function otpError(
  code: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_LOCKED',
  attemptsLeft?: number,
): AppException {
  const messages = {
    OTP_INVALID: 'That code is not right. Check the message and try again.',
    OTP_EXPIRED: 'This code has expired. Ask for a new one.',
    OTP_LOCKED: 'Too many wrong codes. Ask for a new one.',
  };
  return new AppException(
    HttpStatus.BAD_REQUEST,
    code,
    messages[code],
    attemptsLeft === undefined ? undefined : { attemptsLeft },
  );
}

/**
 * The `otps` row lifecycle shared by login (BE-04) and walk-in check-in (BE-16). Codes come from
 * OtpProvider (INT-02) and never go through the notifications outbox. Callers apply rate limits.
 */
@Injectable()
export class OtpChallengeService {
  private readonly logger = new Logger(OtpChallengeService.name);

  constructor(
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    @InjectModel(Otp.name) private readonly otps: Model<Otp>,
  ) {}

  get mode() {
    return this.otp.mode;
  }

  /** Sends a code; a new one replaces any live code for this phone and purpose. */
  async issue(
    phone: string,
    purpose: OtpPurpose,
    language: MessageLanguage,
  ): Promise<{ expiresAt: Date; channel: 'whatsapp' | 'sms' | 'demo' }> {
    let challenge;
    try {
      challenge = await this.otp.send({ phone, purpose, language });
    } catch (e) {
      this.logger.error(
        `OTP delivery failed: ${scrubPersonalData(e instanceof Error ? e.message : String(e))}`,
      );
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'INTERNAL',
        'We could not send the code. Please try again.',
      );
    }
    await this.otps
      .updateOne(
        { phone, purpose },
        {
          $set: {
            codeHash: challenge.codeHash,
            expiresAt: challenge.expiresAt,
            attempts: 0,
            channel: challenge.channel,
          },
        },
        { upsert: true },
      )
      .exec();
    return {
      expiresAt: challenge.expiresAt,
      channel: this.otp.mode === 'demo' ? 'demo' : challenge.channel,
    };
  }

  /** Checks and consumes the code, or throws `OTP_INVALID` / `OTP_EXPIRED` / `OTP_LOCKED`. */
  async consume(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    // Reserve an attempt atomically before checking, so parallel guesses cannot exceed the limit.
    const before = await this.otps
      .findOneAndUpdate(
        { phone, purpose, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: false },
      )
      .exec();
    if (!before) {
      const locked = await this.otps.exists({ phone, purpose }).exec();
      throw otpError(locked ? 'OTP_LOCKED' : 'OTP_EXPIRED');
    }

    const result = await this.otp.verify({
      phone,
      purpose,
      code,
      stored: { codeHash: before.codeHash, expiresAt: before.expiresAt, attempts: before.attempts },
    });
    if (!result.ok) {
      if (result.reason === 'expired') {
        await this.otps.deleteOne({ _id: before._id }).exec();
        throw otpError('OTP_EXPIRED');
      }
      if (result.reason === 'too_many_attempts') throw otpError('OTP_LOCKED');
      throw otpError('OTP_INVALID', Math.max(0, OTP_MAX_ATTEMPTS - before.attempts - 1));
    }

    // Single use: only the request that deletes the row (same code hash) succeeds.
    const consumed = await this.otps
      .deleteOne({ _id: before._id, codeHash: before.codeHash })
      .exec();
    if (consumed.deletedCount !== 1) throw otpError('OTP_EXPIRED');
  }
}
