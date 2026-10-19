/**
 * Notifications outbox (DB doc 3.11, TDD 7). Contract 2.1.0 (BE-21). Business code calls
 * `notify()` in the API; these shapes serve the Demo inbox (FE-17) and the admin failed view
 * (FE-18). OTPs never appear here: they go straight through the OTP provider.
 */
import { z } from 'zod';
import { CursorQuerySchema, IsoDateTimeSchema, ObjectIdSchema } from './common';
import { LanguageSchema } from './enums';

export const NOTIFICATION_CHANNELS = ['whatsapp', 'sms', 'webpush'] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/**
 * DB doc statuses plus `sending` (claimed by the sender job) and `skipped` (kept for dedupe but
 * not sent: the daily WhatsApp alert cap, or the user can no longer be reached).
 */
export const NOTIFICATION_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'skipped',
] as const;
export const NotificationStatusSchema = z.enum(NOTIFICATION_STATUSES);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

/** TDD 6.4: at most 4 WhatsApp status alerts per patient per IST day. */
export const WHATSAPP_ALERTS_PER_DAY = 4;

/**
 * `GET /me/notifications` (demo mode only; 404 in live): the messages the patient would get,
 * newest first. `text` is the rendered template; secret parameters (visit codes) show as `••••`.
 */
export const MyNotificationSchema = z.object({
  id: ObjectIdSchema,
  channel: NotificationChannelSchema,
  template: z.string(),
  language: LanguageSchema,
  text: z.string(),
  status: NotificationStatusSchema,
  createdAt: IsoDateTimeSchema,
  sentAt: IsoDateTimeSchema.nullable(),
});
export type MyNotification = z.infer<typeof MyNotificationSchema>;

export const MyNotificationsQuerySchema = CursorQuerySchema.strict();
export type MyNotificationsQuery = z.input<typeof MyNotificationsQuerySchema>;

/** `GET /admin/notifications?status=failed`, newest first. The phone is masked to its last 4 digits. */
export const AdminNotificationsQuerySchema = CursorQuerySchema.extend({
  status: NotificationStatusSchema.optional(),
}).strict();
export type AdminNotificationsQuery = z.input<typeof AdminNotificationsQuerySchema>;

export const AdminNotificationSchema = z.object({
  id: ObjectIdSchema,
  userId: ObjectIdSchema,
  /** e.g. `••••5678`. */
  phoneMasked: z.string(),
  channel: NotificationChannelSchema,
  template: z.string(),
  status: NotificationStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  /** When the next retry is due, for `queued` rows. */
  sendAfter: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  sentAt: IsoDateTimeSchema.nullable(),
});
export type AdminNotification = z.infer<typeof AdminNotificationSchema>;
