import { CONSOLE_AUDIENCE } from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../config/app-config.service';
import { hashSecret } from '../integrations';
import { AccountRefreshToken } from './account.schema';

export interface AccountTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export type AccountRotateResult =
  | { ok: true; tokens: AccountTokens; accountId: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' | 'raced' };

/** A token rotated this recently and shown again is two tabs refreshing, not theft. */
const RACE_GRACE_MS = 20_000;

/**
 * Console sessions: a short access JWT (`aud: console`, so it never works on patient routes) and
 * a rotating refresh token stored as a peppered hash. Presenting an already-rotated refresh token
 * ends the whole session family.
 */
@Injectable()
export class AccountSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    @InjectModel(AccountRefreshToken.name) private readonly tokens: Model<AccountRefreshToken>,
  ) {}

  private hash(token: string): string {
    return hashSecret(this.config.get('HASH_PEPPER'), 'account-refresh', token);
  }

  /** `audience` is the app the session is for: the provider console or the Doqto admin console. */
  startSession(accountId: string, audience: string = CONSOLE_AUDIENCE): Promise<AccountTokens> {
    return this.issue(accountId, audience, new Types.ObjectId());
  }

  async rotate(
    presented: string,
    isActive: (accountId: string) => Promise<boolean>,
    audience: string = CONSOLE_AUDIENCE,
  ): Promise<AccountRotateResult> {
    const now = new Date();
    const doc = await this.tokens.findOne({ tokenHash: this.hash(presented) }).exec();
    // A refresh token only works for the app that got it.
    if (!doc || (doc.audience ?? CONSOLE_AUDIENCE) !== audience)
      return { ok: false, reason: 'unknown' };
    if (doc.revokedAt) {
      if (doc.replacedBy && now.getTime() - doc.revokedAt.getTime() <= RACE_GRACE_MS) {
        return { ok: false, reason: 'raced' };
      }
      await this.revokeFamily(doc.familyId);
      return { ok: false, reason: 'reused' };
    }
    if (doc.expiresAt <= now) return { ok: false, reason: 'expired' };

    const accountId = doc.accountId.toHexString();
    if (!(await isActive(accountId))) {
      await this.revokeFamily(doc.familyId);
      return { ok: false, reason: 'unknown' };
    }
    const nextId = new Types.ObjectId();
    const claimed = await this.tokens
      .findOneAndUpdate(
        { _id: doc._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now, replacedBy: nextId } },
      )
      .exec();
    if (!claimed) return { ok: false, reason: 'raced' };
    return {
      ok: true,
      tokens: await this.issue(accountId, audience, doc.familyId, nextId),
      accountId,
    };
  }

  /** Signs out this device. Unknown tokens are ignored. */
  async revoke(presented: string): Promise<void> {
    const doc = await this.tokens
      .findOne({ tokenHash: this.hash(presented) }, { familyId: 1 })
      .exec();
    if (doc) await this.revokeFamily(doc.familyId);
  }

  async revokeAll(accountId: string): Promise<void> {
    await this.tokens
      .updateMany(
        { accountId: new Types.ObjectId(accountId), revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  private async revokeFamily(familyId: Types.ObjectId): Promise<void> {
    await this.tokens
      .updateMany({ familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  private async issue(
    accountId: string,
    audience: string,
    familyId: Types.ObjectId,
    id: Types.ObjectId = new Types.ObjectId(),
  ): Promise<AccountTokens> {
    const now = Date.now();
    const accessTtl = this.config.get('JWT_ACCESS_TTL');
    const refreshExpires = new Date(now + this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
    const accessToken = await this.jwt.signAsync(
      { sub: accountId },
      { expiresIn: accessTtl, audience },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    await this.tokens.create({
      _id: id,
      accountId: new Types.ObjectId(accountId),
      tokenHash: this.hash(refreshToken),
      familyId,
      audience,
      expiresAt: refreshExpires,
    });
    return {
      accessToken,
      accessTokenExpiresAt: new Date(now + accessTtl * 1000).toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpires.toISOString(),
    };
  }
}
