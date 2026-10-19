import { OTP_PURPOSES, type OtpPurpose } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * DB doc 3.12 `otps`. Only the peppered hash of the code is stored. The row disappears
 * at `expiresAt` (TTL). One live row per phone and purpose: a new request replaces it.
 */
@Schema({ collection: 'otps', timestamps: true, strict: true })
export class Otp {
  @Prop({ required: true }) phone: string;
  @Prop({ type: String, enum: OTP_PURPOSES, required: true }) purpose: OtpPurpose;
  @Prop({ required: true }) codeHash: string;
  /** Wrong codes entered so far (max 5). */
  @Prop({ default: 0 }) attempts: number;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ type: String, enum: ['whatsapp', 'sms'] }) channel?: 'whatsapp' | 'sms';
}

export type OtpDocument = HydratedDocument<Otp>;
export const OtpSchema = SchemaFactory.createForClass(Otp);
// Unique (the DB doc lists a plain index) so concurrent requests cannot leave two live codes.
OtpSchema.index({ phone: 1, purpose: 1 }, { unique: true });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
