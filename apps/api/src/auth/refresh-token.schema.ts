import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * DB doc 3.12 `refreshTokens`, plus `familyId`: every token rotated from one login shares
 * it, so presenting a revoked token can revoke the whole family (BE-04 reuse detection).
 */
@Schema({ collection: 'refreshTokens', timestamps: true, strict: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  /** Peppered SHA-256 of the opaque token. The token itself is never stored. */
  @Prop({ required: true }) tokenHash: string;
  @Prop({ type: Types.ObjectId, required: true }) familyId: Types.ObjectId;
  @Prop() deviceId?: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop() revokedAt?: Date;
  /** The token that replaced this one on rotation. */
  @Prop({ type: Types.ObjectId }) replacedBy?: Types.ObjectId;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ familyId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
