import {
  ACCOUNT_CODE_LENGTH,
  ACCOUNT_CODE_MAX_ATTEMPTS,
  ACCOUNT_CODE_TTL_SECONDS,
  type CodeSentResponse,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { otpError } from '../auth/otp-challenge.service';
import { AppException } from '../common/http/app-exception';
import { scrubPersonalData } from '../common/logging/scrub';
import { AppConfig } from '../config/app-config.service';
import {
  DEMO_FIXED_OTP,
  EMAIL_PROVIDER,
  INTEGRATIONS_CONFIG,
  SMS_PROVIDER,
  hashSecret,
  randomNumericCode,
  safeEqualHex,
  type EmailProvider,
  type IntegrationsConfig,
  type MessageLanguage,
  type SmsProvider,
} from '../integrations';
import { AccountCode } from './account.schema';

export type CodePurpose = 'verify' | 'reset';

/**
 * One-time codes for provider accounts: confirming a phone or email at registration, and resetting
 * a password. Delivered by email or SMS; in demo mode the code is the fixed demo code and nothing
 * is sent. Codes expire after 10 minutes, allow 5 guesses and work once.
 */
@Injectable()
export class AccountCodeService {
  private readonly logger = new Logger(AccountCodeService.name);

  constructor(
    @InjectModel(AccountCode.name) private readonly codes: Model<AccountCode>,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(INTEGRATIONS_CONFIG) private readonly integrations: IntegrationsConfig,
    private readonly config: AppConfig,
  ) {}

  private hash(identifier: string, purpose: CodePurpose, code: string): string {
    return hashSecret(
      this.config.get('HASH_PEPPER'),
      `account-code:${purpose}:${identifier}`,
      code,
    );
  }

  /** The channel a code to this identifier would use. */
  channelFor(identifier: string): CodeSentResponse['channel'] {
    if (this.integrations.mode === 'demo') return 'demo';
    return identifier.includes('@') ? 'email' : 'sms';
  }

  /** Sends a fresh code, replacing any live one for this identifier and purpose. */
  async issue(
    identifier: string,
    purpose: CodePurpose,
    language: MessageLanguage,
  ): Promise<CodeSentResponse> {
    const demo = this.integrations.mode === 'demo';
    const code = demo ? DEMO_FIXED_OTP : randomNumericCode(ACCOUNT_CODE_LENGTH);
    const expiresAt = new Date(Date.now() + ACCOUNT_CODE_TTL_SECONDS * 1000);
    const isEmail = identifier.includes('@');
    const params = [code, String(ACCOUNT_CODE_TTL_SECONDS / 60)];
    const templateKey = purpose === 'verify' ? 'account_verify_code' : 'account_reset_code';

    try {
      if (isEmail) await this.email.send({ to: identifier, templateKey, language, params });
      else await this.sms.send({ to: identifier, templateKey, language, params });
    } catch (e) {
      this.logger.error(
        `Account code delivery failed: ${scrubPersonalData(e instanceof Error ? e.message : String(e))}`,
      );
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'INTERNAL',
        'We could not send the code. Please try again.',
      );
    }

    await this.codes
      .updateOne(
        { identifier, purpose },
        { $set: { codeHash: this.hash(identifier, purpose, code), expiresAt, attempts: 0 } },
        { upsert: true },
      )
      .exec();
    return {
      expiresAt: expiresAt.toISOString(),
      channel: this.channelFor(identifier),
    };
  }

  /** Checks and uses the code, or throws `OTP_INVALID` / `OTP_EXPIRED` / `OTP_LOCKED`. */
  async consume(identifier: string, purpose: CodePurpose, code: string): Promise<void> {
    // Reserve an attempt before comparing, so parallel guesses cannot beat the limit.
    const before = await this.codes
      .findOneAndUpdate(
        { identifier, purpose, attempts: { $lt: ACCOUNT_CODE_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: false },
      )
      .exec();
    if (!before) {
      const exists = await this.codes.exists({ identifier, purpose }).exec();
      throw otpError(exists ? 'OTP_LOCKED' : 'OTP_EXPIRED');
    }
    if (before.expiresAt <= new Date()) {
      await this.codes.deleteOne({ _id: before._id }).exec();
      throw otpError('OTP_EXPIRED');
    }
    if (!safeEqualHex(before.codeHash, this.hash(identifier, purpose, code))) {
      throw otpError('OTP_INVALID', Math.max(0, ACCOUNT_CODE_MAX_ATTEMPTS - before.attempts - 1));
    }
    // Single use: only the request that deletes the row succeeds.
    const used = await this.codes.deleteOne({ _id: before._id, codeHash: before.codeHash }).exec();
    if (used.deletedCount !== 1) throw otpError('OTP_EXPIRED');
  }

  async discard(identifier: string, purpose: CodePurpose): Promise<void> {
    await this.codes.deleteOne({ identifier, purpose }).exec();
  }
}
