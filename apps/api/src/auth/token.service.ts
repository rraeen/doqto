import { type Role } from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../config/app-config.service';
import { hashSecret } from '../integrations';
import type { IssuedTokens as TokenPair } from './auth-cookies';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';

export type RotateResult =
  | { ok: true; pair: TokenPair; userId: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' | 'raced' };

/** A token rotated this recently and presented again is a parallel refresh, not theft. */
export const REFRESH_RACE_GRACE_MS = 20_000;

/**
 * Access tokens: 15-minute HS256 JWTs `{ sub, roles }`.
 * Refresh tokens: 32 random bytes (base64url), stored only as a peppered hash, rotated on
 * every use. Each login starts a family; presenting an already-rotated token revokes the
 * whole family (stolen-token detection).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshToken>,
  ) {}

  hash(token: string): string {
    return hashSecret(this.config.get('HASH_PEPPER'), 'refresh', token);
  }

  /** Issues a pair for a new login (new family). */
  async issueForLogin(user: { id: string; roles: Role[] }, deviceId?: string): Promise<TokenPair> {
    return this.issue(user, new Types.ObjectId(), deviceId).then((r) => r.pair);
  }

  /**
   * Rotates `presented`: revokes it and issues a new pair in the same family. `loadRoles`
   * returns the user's current roles (or null to refuse, e.g. suspended), so role changes
   * reach the access token at the next refresh.
   */
  async rotate(
    presented: string,
    loadRoles: (userId: string) => Promise<Role[] | null>,
  ): Promise<RotateResult> {
    const now = new Date();
    const doc = await this.tokens.findOne({ tokenHash: this.hash(presented) }).exec();
    if (!doc) return { ok: false, reason: 'unknown' };
    if (doc.revokedAt) {
      // Two tabs refreshing at once: the loser presents a token rotated moments ago. Refuse it
      // without revoking the family, so the winner's new token stands (RD BE-04 should-fix 2).
      if (doc.replacedBy && now.getTime() - doc.revokedAt.getTime() <= REFRESH_RACE_GRACE_MS) {
        return { ok: false, reason: 'raced' };
      }
      await this.revokeFamily(doc.familyId);
      return { ok: false, reason: 'reused' };
    }
    if (doc.expiresAt <= now) return { ok: false, reason: 'expired' };

    const userId = doc.userId.toHexString();
    const roles = await loadRoles(userId);
    if (!roles) {
      await this.revokeFamily(doc.familyId);
      return { ok: false, reason: 'unknown' };
    }
    const nextId = new Types.ObjectId();
    // Claim the old token atomically: of two concurrent refreshes only one wins; the other is reuse.
    const claimed = await this.tokens
      .findOneAndUpdate(
        { _id: doc._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now, replacedBy: nextId } },
      )
      .exec();
    // Lost the claim to a concurrent refresh of the same token: same as the grace case above.
    if (!claimed) return { ok: false, reason: 'raced' };
    const { pair } = await this.issue({ id: userId, roles }, doc.familyId, doc.deviceId, nextId);
    return { ok: true, pair, userId };
  }

  /** Logout: revokes the presented token's family (that device's session). Unknown tokens are ignored. */
  async revoke(presented: string): Promise<void> {
    const doc = await this.tokens
      .findOne({ tokenHash: this.hash(presented) }, { familyId: 1 })
      .exec();
    if (doc) await this.revokeFamily(doc.familyId);
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.tokens
      .updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  private async revokeFamily(familyId: Types.ObjectId): Promise<void> {
    await this.tokens
      .updateMany({ familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  private async issue(
    user: { id: string; roles: Role[] },
    familyId: Types.ObjectId,
    deviceId?: string,
    id: Types.ObjectId = new Types.ObjectId(),
  ): Promise<{ pair: TokenPair; doc: RefreshTokenDocument }> {
    const now = Date.now();
    const accessTtl = this.config.get('JWT_ACCESS_TTL');
    const refreshTtlMs = this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000;
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, roles: user.roles },
      { expiresIn: accessTtl },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpires = new Date(now + refreshTtlMs);
    const doc = await this.tokens.create({
      _id: id,
      userId: new Types.ObjectId(user.id),
      tokenHash: this.hash(refreshToken),
      familyId,
      deviceId,
      expiresAt: refreshExpires,
    });
    return {
      doc,
      pair: {
        accessToken,
        accessTokenExpiresAt: new Date(now + accessTtl * 1000).toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshExpires.toISOString(),
      },
    };
  }
}
