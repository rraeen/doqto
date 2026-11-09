import {
  OTP_REQUEST_LIMIT,
  OTP_REQUEST_WINDOW_SECONDS,
  type OtpRequestResponse,
  type OtpVerifyResponse,
  type Role,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { AppConfig } from '../config/app-config.service';
import { hashSecret } from '../integrations';
import { assertActive, toMe, UsersService } from '../users/users.service';
import type { IssuedTokens as TokenPair } from './auth-cookies';
import { OtpChallengeService } from './otp-challenge.service';
import { TokenService } from './token.service';

const PURPOSE = 'login' as const;

/**
 * `REFRESH_INVALID` for the losing tab of a parallel refresh. The controller leaves the cookies
 * alone, so the winning tab's fresh cookies are not cleared.
 */
export class RefreshRacedException extends AppException {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Please log in again.', { raced: true });
  }
}
const WINDOW_MS = OTP_REQUEST_WINDOW_SECONDS * 1000;

/** Phone OTP login (BE-04, TDD 11). OTP generation, delivery and code checks belong to OtpProvider (INT-02). */
@Injectable()
export class AuthService {
  constructor(
    private readonly challenges: OtpChallengeService,
    @InjectThrottlerStorage() private readonly limiter: ThrottlerStorage,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
  ) {}

  /** 3 requests per 10 minutes per phone and, separately, per IP. Keys hold no plain phone. */
  private async enforceRequestLimit(phone: string, ip: string): Promise<void> {
    const pepper = this.config.get('HASH_PEPPER');
    for (const key of [`otp-ip:${ip}`, `otp-phone:${hashSecret(pepper, 'ratelimit', phone)}`]) {
      const rec = await this.limiter.increment(
        key,
        WINDOW_MS,
        OTP_REQUEST_LIMIT,
        WINDOW_MS,
        'otp-request',
      );
      if (rec.isBlocked) throw AppException.rateLimited(Math.max(1, rec.timeToBlockExpire));
    }
  }

  async requestOtp(phone: string, ip: string): Promise<OtpRequestResponse> {
    await this.enforceRequestLimit(phone, ip);
    const existing = await this.users.findByPhone(phone);
    const language = existing?.language ?? 'en';

    const sent = await this.challenges.issue(phone, PURPOSE, language);
    return { expiresAt: sent.expiresAt.toISOString(), channel: sent.channel };
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    deviceId?: string;
    whatsappOptIn?: boolean;
  }): Promise<OtpVerifyResponse & TokenPair> {
    const { phone, code } = input;
    await this.challenges.consume(phone, PURPOSE, code);

    const { user, isNew } = await this.users.upsertOnLogin(phone, {
      whatsappOptIn: input.whatsappOptIn,
    });
    assertActive(user);
    const pair = await this.tokens.issueForLogin(
      { id: user._id.toHexString(), roles: user.roles },
      input.deviceId,
    );
    return { ...pair, user: toMe(user), isNewUser: isNew };
  }

  async refresh(presented: string | undefined): Promise<TokenPair> {
    if (!presented) throw this.refreshInvalid();
    let suspended = false;
    const result = await this.tokens.rotate(presented, async (userId): Promise<Role[] | null> => {
      const user = await this.users.findById(userId);
      if (!user) return null;
      if (user.status !== 'active') {
        suspended = true;
        return null;
      }
      return user.roles;
    });
    if (suspended) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_SUSPENDED',
        'This account is not active. Contact Doqto support.',
      );
    }
    if (!result.ok) {
      if (result.reason === 'raced') throw new RefreshRacedException();
      throw this.refreshInvalid();
    }
    return result.pair;
  }

  async logout(presented: string | undefined): Promise<void> {
    if (presented) await this.tokens.revoke(presented);
  }

  /** Ends every session of the user, on every device. */
  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(new Types.ObjectId(userId));
  }

  private refreshInvalid(): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Please log in again.');
  }
}
