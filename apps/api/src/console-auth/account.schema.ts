import { ACCOUNT_STATUSES } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A person who runs a practice on Doqto. Kept apart from the patient `users` collection. What they
 * can open (clinic, lab, pharmacy) comes from their memberships, not from the account.
 */
@Schema({ collection: 'accounts', timestamps: true, strict: true })
export class Account {
  @Prop({ required: true }) name: string;
  /** Lower-cased. At least one of email and phone is set. */
  @Prop() email?: string;
  /** E.164. */
  @Prop() phone?: string;
  /** `scrypt$...` self-describing hash (see PasswordService). Never returned by any route. */
  @Prop({ required: true }) passwordHash: string;
  @Prop({ type: String, enum: ['en', 'hi'], default: 'en' }) language: 'en' | 'hi';
  @Prop({ type: String, enum: ACCOUNT_STATUSES, default: 'active' }) status: 'active' | 'suspended';
  /** Set once the phone or email code is confirmed; sign-in needs it. */
  @Prop() contactVerifiedAt?: Date;
  @Prop({ default: 0 }) failedLogins: number;
  @Prop() lockedUntil?: Date;
  @Prop() passwordChangedAt?: Date;
  @Prop() lastLoginAt?: Date;
  /** Set by hand for members of the Doqto team (`admin:create`). Never settable through sign-up. */
  @Prop({ type: String, enum: ['admin'] }) platformRole?: 'admin';
}

export type AccountDocument = HydratedDocument<Account>;
export const AccountSchema = SchemaFactory.createForClass(Account);
// Sparse unique: an account may have only an email or only a phone.
AccountSchema.index({ email: 1 }, { unique: true, sparse: true });
AccountSchema.index({ phone: 1 }, { unique: true, sparse: true });

/** A live verification or password-reset code. Only the peppered hash is stored. */
@Schema({ collection: 'accountCodes', timestamps: true, strict: true })
export class AccountCode {
  @Prop({ required: true }) identifier: string;
  @Prop({ type: String, enum: ['verify', 'reset'], required: true }) purpose: 'verify' | 'reset';
  @Prop({ required: true }) codeHash: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ required: true }) expiresAt: Date;
}
export const AccountCodeSchema = SchemaFactory.createForClass(AccountCode);
AccountCodeSchema.index({ identifier: 1, purpose: 1 }, { unique: true });
AccountCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Same rotation scheme as the patient refresh tokens, for accounts. */
@Schema({ collection: 'accountRefreshTokens', timestamps: true, strict: true })
export class AccountRefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true }) accountId: Types.ObjectId;
  @Prop({ required: true }) tokenHash: string;
  @Prop({ type: Types.ObjectId, required: true }) familyId: Types.ObjectId;
  /** Which app this session is for: `console` (providers) or `admin` (the Doqto team). */
  @Prop({ type: String, default: 'console' }) audience: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop() revokedAt?: Date;
  @Prop({ type: Types.ObjectId }) replacedBy?: Types.ObjectId;
}
export const AccountRefreshTokenSchema = SchemaFactory.createForClass(AccountRefreshToken);
AccountRefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
AccountRefreshTokenSchema.index({ accountId: 1 });
AccountRefreshTokenSchema.index({ familyId: 1 });
AccountRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
