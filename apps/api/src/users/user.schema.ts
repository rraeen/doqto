import {
  LANGUAGES,
  ROLES,
  USER_STATUSES,
  type Language,
  type Role,
  type UserStatus,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class ConsentEntry {
  /** e.g. `whatsapp`, `privacy_policy`. */
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) version: string;
  /** Whether consent was given (`false` records a withdrawal). */
  @Prop({ required: true }) granted: boolean;
  @Prop({ required: true }) at: Date;
}
const ConsentEntrySchema = SchemaFactory.createForClass(ConsentEntry);

// Has its own `_id`: the patient removes a device by it.
@Schema()
export class PushSubscriptionEntry {
  @Prop({ required: true }) endpointHash: string;
  @Prop({ required: true }) endpoint: string;
  @Prop({ type: Object, required: true }) keys: { p256dh: string; auth: string };
  @Prop({ required: true }) createdAt: Date;
}
const PushSubscriptionEntrySchema = SchemaFactory.createForClass(PushSubscriptionEntry);

/** DB doc 3.1 `users`, plus `isDemo` (TDD 13 rule 5). */
@Schema({ collection: 'users', timestamps: true, strict: true })
export class User {
  /** E.164, unique. */
  @Prop({ required: true }) phone: string;
  @Prop() phoneVerifiedAt?: Date;
  @Prop({ trim: true, maxlength: 80 }) name?: string;
  @Prop({ type: [String], enum: ROLES, default: ['patient'] }) roles: Role[];
  @Prop({ type: String, enum: LANGUAGES, default: 'en' }) language: Language;
  @Prop({ default: true }) whatsappOptIn: boolean;
  @Prop({ type: [ConsentEntrySchema], default: [] }) consentLog: ConsentEntry[];
  @Prop({ type: String, enum: USER_STATUSES, default: 'active' }) status: UserStatus;
  /** Last 5 hashed device fingerprints (INT-15). */
  @Prop({ type: [String], default: [] }) deviceHashes: string[];
  @Prop({ type: [PushSubscriptionEntrySchema], default: [] })
  pushSubscriptions: PushSubscriptionEntry[];
  /** Clinics where the user is staff (role `clinic_staff`). */
  @Prop({ type: [Types.ObjectId], ref: 'Clinic', default: [] }) clinicIds: Types.ObjectId[];
  @Prop() lastLoginAt?: Date;
  /** BE-21 daily WhatsApp alert cap: IST date and alerts sent that day. */
  @Prop({ type: Object }) alertCounter?: { date: string; count: number };
  /** Created while PROVIDER_MODE=demo; wiped before go-live. */
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index({ roles: 1, status: 1 });
