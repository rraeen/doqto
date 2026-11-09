import {
  LANGUAGES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  type Language,
  type NotificationChannel,
  type NotificationStatus,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** DB doc 3.11 `notifications` outbox. */
@Schema({ collection: 'notifications', timestamps: true, strict: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) phone: string;
  @Prop({ type: String, enum: NOTIFICATION_CHANNELS, required: true }) channel: NotificationChannel;
  /** Key into INT's `templates.ts`. */
  @Prop({ required: true }) template: string;
  @Prop({ type: String, enum: LANGUAGES, required: true }) language: Language;
  /** Positional template parameters; secret ones are empty here and live in `sealed`. */
  @Prop({ type: [String], default: [] }) params: string[];
  /** Encrypted secret parameters (visit codes), removed once sent (RD on INT-08). */
  @Prop() sealed?: string;
  @Prop({ required: true }) dedupeKey: string;
  @Prop({ type: String, enum: NOTIFICATION_STATUSES, default: 'queued' })
  status: NotificationStatus;
  @Prop() providerMessageId?: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ maxlength: 500 }) lastError?: string;
  @Prop({ required: true }) sendAfter: Date;
  /** While `sending`: when another sender may take it over. */
  @Prop() lockedUntil?: Date;
  @Prop() sentAt?: Date;
  @Prop() deliveredAt?: Date;
  /** When the patient opened the inbox after this arrived. */
  @Prop() readAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Appointment' }) appointmentId?: Types.ObjectId;
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ dedupeKey: 1 }, { unique: true });
NotificationSchema.index({ status: 1, sendAfter: 1 });
NotificationSchema.index(
  { providerMessageId: 1 },
  { partialFilterExpression: { providerMessageId: { $type: 'string' } } },
);
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
// Demo inbox (FE-17) and the admin failed view (FE-18).
NotificationSchema.index({ userId: 1, _id: -1 });
NotificationSchema.index({ status: 1, _id: -1 });
