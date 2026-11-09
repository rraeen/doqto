/**
 * Account, push and transparency shapes (contract v5, DPDP Act 2023 rights and TDD sections
 * 5.7 and 9): a patient can register a device for Web Push, download everything Doqto holds about
 * them, and delete their account. The transparency numbers are public.
 */
import { z } from 'zod';
import { MyAppointmentSchema } from './appointments';
import { IsoDateTimeSchema, ObjectIdSchema } from './common';
import { MeSchema } from './me';
import { MyReviewSchema, ReportReasonSchema } from './reviews';

// ---------------------------------------------------------------- web push (BE-39)

/** A signed-in user can register at most this many devices for push. */
export const PUSH_SUBSCRIPTIONS_MAX = 5;

/** The browser's `PushSubscription.toJSON()`, sent as it is. */
export const PushSubscriptionRequestSchema = z
  .object({
    endpoint: z.url().max(2048),
    keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
  })
  .strict();
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionRequestSchema>;

/** `POST /me/push-subscriptions`. The same endpoint twice is one device, not two. */
export const PushSubscriptionResponseSchema = z.object({
  id: ObjectIdSchema,
  /** How many devices are registered now. */
  count: z.number().int().min(1).max(PUSH_SUBSCRIPTIONS_MAX),
});
export type PushSubscriptionResponse = z.infer<typeof PushSubscriptionResponseSchema>;

// ---------------------------------------------------------------- my data (BE-42)

/** `GET /me/export`: everything Doqto holds about the patient, as one file they can keep. */
export const MyDataExportSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  profile: MeSchema,
  /** The visit code is left out: it is only for the front desk. */
  appointments: z.array(MyAppointmentSchema.omit({ visitCode: true })),
  reviews: z.array(MyReviewSchema),
});
export type MyDataExport = z.infer<typeof MyDataExportSchema>;

/** The word the patient types to confirm deleting their account. */
export const DELETE_CONFIRM_WORD = 'DELETE';

/**
 * `DELETE /me`. Removes name, phone and sign-in tokens, blanks the name and phone on past
 * appointments, shows reviews as "Verified patient", and keeps payment amounts as the law
 * requires (DB doc section 6). Cannot be undone.
 */
export const DeleteAccountRequestSchema = z
  .object({ confirm: z.literal(DELETE_CONFIRM_WORD) })
  .strict();
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

// ---------------------------------------------------------------- transparency (BE-41)

const CountsByParty = z.object({
  doctor: z.number().int().min(0),
  patient: z.number().int().min(0),
});

/** One month of review numbers: the public proof that reviews are not for sale. */
export const TransparencyMonthSchema = z.object({
  /** `YYYY-MM` */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  reviewsSubmitted: z.number().int().min(0),
  reviewsPublished: z.number().int().min(0),
  reviewsHeld: z.number().int().min(0),
  /** Reviews taken down, by the reason given. */
  reviewsRemoved: z.partialRecord(ReportReasonSchema, z.number().int().min(0)),
  appealsFiled: CountsByParty,
  appealsUpheld: CountsByParty,
});
export type TransparencyMonth = z.infer<typeof TransparencyMonthSchema>;

/** `GET /transparency`: the latest months, newest first. Public, no sign-in. */
export const TransparencyResponseSchema = z.object({
  months: z.array(TransparencyMonthSchema),
  updatedAt: IsoDateTimeSchema,
});
export type TransparencyResponse = z.infer<typeof TransparencyResponseSchema>;
