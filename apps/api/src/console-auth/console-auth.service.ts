import {
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  type CodeSentResponse,
  type ConsoleAccount,
  type ConsoleChangePasswordRequest,
  type ConsoleLoginRequest,
  type ConsoleRegisterRequest,
  type ConsoleResetPasswordRequest,
  type Workspace,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { AppConfig } from '../config/app-config.service';
import { hashSecret } from '../integrations';
import { AccountCodeService } from './account-code.service';
import { AccountSessionService, type AccountTokens } from './account-session.service';
import { Account, type AccountDocument } from './account.schema';
import { PasswordService } from './password.service';
import { WorkspacesService } from './workspaces.service';

const WINDOW_MS = 10 * 60_000;
/** Codes sent per phone or email, and requests per IP, in the window above. */
const CODES_PER_IDENTIFIER = 5;
const REQUESTS_PER_IP = 20;

/** Emails and usernames compare lower-cased; phones are already E.164 (they start with `+`). */
export function normalizeIdentifier(identifier: string): string {
  const v = identifier.trim();
  return v.startsWith('+') ? v : v.toLowerCase();
}

/** A staff login name: neither an email (has `@`) nor a phone (starts with `+`). */
function isUsername(identifier: string): boolean {
  return !identifier.includes('@') && !identifier.startsWith('+');
}

function lookup(identifier: string): { email: string } | { phone: string } | { username: string } {
  if (identifier.includes('@')) return { email: identifier };
  return identifier.startsWith('+') ? { phone: identifier } : { username: identifier };
}

export function toConsoleAccount(a: AccountDocument, workspaces: Workspace[]): ConsoleAccount {
  return {
    id: a._id.toHexString(),
    name: a.name,
    email: a.email ?? null,
    phone: a.phone ?? null,
    username: a.username ?? null,
    mustChangePassword: a.mustChangePassword ?? false,
    language: a.language,
    status: a.status,
    platformRole: a.platformRole ?? null,
    workspaces,
  };
}

export interface SignedIn {
  account: ConsoleAccount;
  tokens: AccountTokens;
}

export class ConsoleRefreshRacedException extends AppException {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Please sign in again.', { raced: true });
  }
}

/**
 * Registration, sign-in and password reset for the people who run a practice on Doqto. A phone or
 * an email plus a password, confirmed once with a code; no code at each sign-in. Everything about
 * who may see what comes later (organizations, memberships); this only proves who the person is.
 */
@Injectable()
export class ConsoleAuthService {
  constructor(
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectThrottlerStorage() private readonly limiter: ThrottlerStorage,
    private readonly passwords: PasswordService,
    private readonly codes: AccountCodeService,
    private readonly sessions: AccountSessionService,
    private readonly workspaces: WorkspacesService,
    private readonly config: AppConfig,
  ) {}

  /** Limits code sends per phone or email and requests per IP. Keys hold no plain contact. */
  private async enforceLimits(identifier: string, ip: string): Promise<void> {
    const pepper = this.config.get('HASH_PEPPER');
    const checks: [string, number][] = [
      [`acct-ip:${ip}`, REQUESTS_PER_IP],
      [`acct-id:${hashSecret(pepper, 'ratelimit', identifier)}`, CODES_PER_IDENTIFIER],
    ];
    for (const [key, limit] of checks) {
      const rec = await this.limiter.increment(key, WINDOW_MS, limit, WINDOW_MS, 'account-code');
      if (rec.isBlocked) throw AppException.rateLimited(Math.max(1, rec.timeToBlockExpire));
    }
  }

  async register(input: ConsoleRegisterRequest, ip: string): Promise<CodeSentResponse> {
    const identifier = normalizeIdentifier(input.identifier);
    await this.enforceLimits(identifier, ip);
    const language = input.language ?? 'en';
    const passwordHash = await this.passwords.hash(input.password);

    const existing = await this.accounts.findOne(lookup(identifier)).exec();
    if (existing?.contactVerifiedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This phone or email is already registered. Sign in instead.',
      );
    }
    if (existing) {
      // Registered earlier but never confirmed: the new details replace the old ones.
      existing.set({ name: input.name, passwordHash, language });
      await existing.save();
      await this.workspaces.resetFor({ id: existing._id, name: input.name });
    } else {
      try {
        const created = await this.accounts.create({
          ...lookup(identifier),
          name: input.name,
          passwordHash,
          language,
          passwordChangedAt: new Date(),
        });
        await this.workspaces.createFor({ id: created._id, name: input.name });
      } catch (e) {
        if ((e as { code?: number }).code === 11000) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'CONFLICT',
            'This phone or email is already registered. Sign in instead.',
          );
        }
        throw e;
      }
    }
    return this.codes.issue(identifier, 'verify', language);
  }

  /** Sends the confirmation code again. Says nothing about whether the account exists. */
  async resend(rawIdentifier: string, ip: string): Promise<CodeSentResponse> {
    const identifier = normalizeIdentifier(rawIdentifier);
    await this.enforceLimits(identifier, ip);
    // A username has nowhere to send a code to: answer like any unknown account.
    if (isUsername(identifier)) return this.decoy(identifier);
    const account = await this.accounts
      .findOne({ ...lookup(identifier), contactVerifiedAt: { $exists: false } })
      .exec();
    if (account) return this.codes.issue(identifier, 'verify', account.language);
    return this.decoy(identifier);
  }

  async verify(rawIdentifier: string, code: string): Promise<SignedIn> {
    const identifier = normalizeIdentifier(rawIdentifier);
    await this.codes.consume(identifier, 'verify', code);
    const account = await this.accounts
      .findOneAndUpdate(
        lookup(identifier),
        { $set: { contactVerifiedAt: new Date(), lastLoginAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!account) throw AppException.notFound('No account for this phone or email');
    this.assertActive(account);
    return this.signIn(account);
  }

  private async signIn(account: AccountDocument): Promise<SignedIn> {
    return {
      account: toConsoleAccount(account, await this.workspaces.list(account._id)),
      tokens: await this.sessions.startSession(account._id.toHexString()),
    };
  }

  async login(input: ConsoleLoginRequest, ip: string): Promise<SignedIn> {
    return this.signIn(await this.authenticate(input, ip));
  }

  /** Checks the phone or email and password (lock, wrong-password count, confirmed contact). */
  async authenticate(input: ConsoleLoginRequest, ip: string): Promise<AccountDocument> {
    const identifier = normalizeIdentifier(input.identifier);
    const rec = await this.limiter.increment(
      `acct-login-ip:${ip}`,
      WINDOW_MS,
      60,
      WINDOW_MS,
      'account-login',
    );
    if (rec.isBlocked) throw AppException.rateLimited(Math.max(1, rec.timeToBlockExpire));

    const account = await this.accounts.findOne(lookup(identifier)).exec();
    if (!account) {
      await this.passwords.verifyAgainstNothing(input.password);
      throw this.invalidCredentials();
    }
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      const seconds = Math.ceil((account.lockedUntil.getTime() - Date.now()) / 1000);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'RATE_LIMITED',
        'Too many wrong passwords. Try again later or reset your password.',
        { retryAfterSeconds: seconds },
      );
    }
    if (!(await this.passwords.verify(input.password, account.passwordHash))) {
      await this.recordFailure(account._id);
      throw this.invalidCredentials();
    }
    this.assertActive(account);
    if (!account.contactVerifiedAt) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'CONTACT_NOT_VERIFIED',
        'Confirm your phone or email with the code we sent, then sign in.',
      );
    }
    await this.accounts
      .updateOne(
        { _id: account._id },
        { $set: { failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: '' } },
      )
      .exec();
    return account;
  }

  /** Always answers the same way, so it cannot be used to find out who is registered. */
  async forgotPassword(rawIdentifier: string, ip: string): Promise<CodeSentResponse> {
    const identifier = normalizeIdentifier(rawIdentifier);
    await this.enforceLimits(identifier, ip);
    // Staff have no phone or email: the owner resets their password from the Staff screen.
    if (isUsername(identifier)) return this.decoy(identifier);
    const account = await this.accounts.findOne({ ...lookup(identifier), status: 'active' }).exec();
    if (account) return this.codes.issue(identifier, 'reset', account.language);
    return this.decoy(identifier);
  }

  /** A signed-in account chooses a new password. Other devices are signed out. */
  async changePassword(accountId: string, input: ConsoleChangePasswordRequest): Promise<void> {
    if (!Types.ObjectId.isValid(accountId)) throw AppException.unauthenticated();
    const account = await this.accounts.findById(accountId).exec();
    if (!account) throw AppException.unauthenticated();
    if (!(await this.passwords.verify(input.currentPassword, account.passwordHash))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Your current password is not right.',
      );
    }
    if (input.newPassword === input.currentPassword) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Choose a new password', {
        issues: [{ path: 'newPassword', message: 'Use a password you have not used before' }],
      });
    }
    await this.accounts
      .updateOne(
        { _id: account._id },
        {
          $set: {
            passwordHash: await this.passwords.hash(input.newPassword),
            passwordChangedAt: new Date(),
            mustChangePassword: false,
          },
        },
      )
      .exec();
  }

  async resetPassword(input: ConsoleResetPasswordRequest): Promise<void> {
    const identifier = normalizeIdentifier(input.identifier);
    await this.codes.consume(identifier, 'reset', input.code);
    const account = await this.accounts.findOne(lookup(identifier)).exec();
    if (!account) throw AppException.notFound('No account for this phone or email');
    const passwordHash = await this.passwords.hash(input.newPassword);
    const now = new Date();
    await this.accounts
      .updateOne(
        { _id: account._id },
        {
          $set: {
            passwordHash,
            passwordChangedAt: now,
            failedLogins: 0,
            // Getting the reset code proves control of the phone or email.
            contactVerifiedAt: account.contactVerifiedAt ?? now,
          },
          $unset: { lockedUntil: '' },
        },
      )
      .exec();
    // A reset is also the answer to a stolen password: every device signs in again.
    await this.sessions.revokeAll(account._id.toHexString());
  }

  async refresh(presented: string | undefined): Promise<AccountTokens> {
    if (!presented) throw this.refreshInvalid();
    let suspended = false;
    const result = await this.sessions.rotate(presented, async (id) => {
      const a = await this.accounts.findById(id).exec();
      if (a?.status === 'suspended') suspended = true;
      return a?.status === 'active' && !!a.contactVerifiedAt;
    });
    if (suspended) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_SUSPENDED',
        'This account is not active. Contact Doqto support.',
      );
    }
    if (!result.ok) {
      if (result.reason === 'raced') throw new ConsoleRefreshRacedException();
      throw this.refreshInvalid();
    }
    return result.tokens;
  }

  async logout(presented: string | undefined): Promise<void> {
    if (presented) await this.sessions.revoke(presented);
  }

  async me(accountId: string): Promise<ConsoleAccount> {
    if (!Types.ObjectId.isValid(accountId)) throw AppException.unauthenticated();
    const account = await this.accounts.findById(accountId).exec();
    if (!account || !account.contactVerifiedAt) throw AppException.unauthenticated();
    this.assertActive(account);
    return toConsoleAccount(account, await this.workspaces.list(account._id));
  }

  private async recordFailure(id: Types.ObjectId): Promise<void> {
    const updated = await this.accounts
      .findOneAndUpdate({ _id: id }, { $inc: { failedLogins: 1 } }, { new: true })
      .exec();
    if (updated && updated.failedLogins >= LOGIN_MAX_FAILURES) {
      await this.accounts
        .updateOne(
          { _id: id },
          {
            $set: {
              lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000),
              failedLogins: 0,
            },
          },
        )
        .exec();
    }
  }

  private assertActive(a: AccountDocument): void {
    if (a.status !== 'active') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_SUSPENDED',
        'This account is not active. Contact Doqto support.',
      );
    }
  }

  private invalidCredentials(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      'That phone, email or password is not right.',
    );
  }

  private refreshInvalid(): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Please sign in again.');
  }

  /** The reply for an identifier with no account: same shape as a real one, nothing is sent. */
  private decoy(identifier: string): CodeSentResponse {
    return {
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      channel: this.codes.channelFor(identifier),
    };
  }
}
