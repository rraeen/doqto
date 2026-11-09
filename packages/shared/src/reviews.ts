/**
 * Review shapes (contract v4, TDD section 5, DB doc 3.7). A review can only exist for a
 * verified, finished visit, one review per visit, and a patient sees it open 24 hours after the
 * visit. Nothing here carries clinical detail (ADR 0007): the reason is a short fixed list.
 */
import { z } from 'zod';
import { CursorQuerySchema, IsoDateTimeSchema, ObjectIdSchema, pageSchema } from './common';
import { VisitReasonSchema } from './appointments';
import { WouldRecommendSchema } from './enums';

// ---------------------------------------------------------------- rules (TDD 5.2, 5.4)

/** The form opens this long after the visit ends. */
export const REVIEW_UNLOCK_HOURS = 24;
/** Once open, the form stays open this many days. */
export const REVIEW_WINDOW_DAYS = 30;
/** A patient may edit their review once, within this many days of submitting. */
export const REVIEW_EDIT_DAYS = 7;
export const REVIEW_TEXT_MIN = 20;
export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_WAIT_MAX_MINUTES = 600;

/** The five things a patient rates, each from 1 to 5. */
export const RATING_DIMENSIONS = [
  'waitTime',
  'explanation',
  'behaviour',
  'facilities',
  'valueForMoney',
] as const;
export const RatingDimensionSchema = z.enum(RATING_DIMENSIONS);
export type RatingDimension = z.infer<typeof RatingDimensionSchema>;

const StarSchema = z.number().int().min(1).max(5);
export const ReviewRatingsSchema = z
  .object({
    waitTime: StarSchema,
    explanation: StarSchema,
    behaviour: StarSchema,
    facilities: StarSchema,
    valueForMoney: StarSchema,
  })
  .strict();
export type ReviewRatings = z.infer<typeof ReviewRatingsSchema>;

/** `reviews.state` (DB doc 3.7). A patient sees their own review in any state. */
export const REVIEW_STATES = [
  'cooling_down',
  'pending_checks',
  'published',
  'held_for_review',
  'hidden',
  'removed',
] as const;
export const ReviewStateSchema = z.enum(REVIEW_STATES);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

/** Where a finished visit stands for reviewing. */
export type ReviewWindowState = 'locked' | 'open' | 'expired';

/** When the form opens and closes for a visit that ended at `visitEndedAt`. */
export function reviewWindow(visitEndedAt: string): { unlocksAt: string; closesAt: string } {
  const unlocks = Date.parse(visitEndedAt) + REVIEW_UNLOCK_HOURS * 3_600_000;
  return {
    unlocksAt: new Date(unlocks).toISOString(),
    closesAt: new Date(unlocks + REVIEW_WINDOW_DAYS * 86_400_000).toISOString(),
  };
}

export function reviewWindowState(visitEndedAt: string, now: number): ReviewWindowState {
  const { unlocksAt, closesAt } = reviewWindow(visitEndedAt);
  if (now < Date.parse(unlocksAt)) return 'locked';
  return now <= Date.parse(closesAt) ? 'open' : 'expired';
}

/** A review can be edited once, within 7 days of submitting. */
export function canEditReview(input: {
  submittedAt: string;
  editedAt: string | null;
  now: number;
}) {
  if (input.editedAt) return false;
  return input.now - Date.parse(input.submittedAt) <= REVIEW_EDIT_DAYS * 86_400_000;
}

// ---------------------------------------------------------------- eligibility

export const REVIEW_ELIGIBILITY_STATES = ['locked', 'open', 'reviewed', 'expired'] as const;
export const ReviewEligibilityStateSchema = z.enum(REVIEW_ELIGIBILITY_STATES);
export type ReviewEligibilityState = z.infer<typeof ReviewEligibilityStateSchema>;

/** One finished visit and whether it can be reviewed now (`GET /reviews/eligibility`). */
export const ReviewEligibilitySchema = z.object({
  appointmentId: ObjectIdSchema,
  doctor: z.object({ id: ObjectIdSchema, name: z.string(), slug: z.string() }),
  clinicName: z.string(),
  /** When the visit ended. */
  visitEndedAt: IsoDateTimeSchema,
  state: ReviewEligibilityStateSchema,
  unlocksAt: IsoDateTimeSchema,
  closesAt: IsoDateTimeSchema,
  /** Set once the patient has reviewed this visit. */
  reviewId: ObjectIdSchema.nullable(),
});
export type ReviewEligibility = z.infer<typeof ReviewEligibilitySchema>;

export const ReviewEligibilityResponseSchema = z.object({
  items: z.array(ReviewEligibilitySchema),
});
export type ReviewEligibilityResponse = z.infer<typeof ReviewEligibilityResponseSchema>;

// ---------------------------------------------------------------- submit and edit

const reviewBody = {
  ratings: ReviewRatingsSchema,
  wouldRecommend: WouldRecommendSchema,
  reason: VisitReasonSchema,
  text: z.string().trim().min(REVIEW_TEXT_MIN).max(REVIEW_TEXT_MAX).optional(),
  /** How long the patient waited, if they want to say. */
  waitedMinutes: z.number().int().min(0).max(REVIEW_WAIT_MAX_MINUTES).optional(),
};

/** `POST /reviews`. 409 `CONFLICT` if the visit is already reviewed; 403 while locked or closed. */
export const CreateReviewRequestSchema = z
  .object({ appointmentId: ObjectIdSchema, ...reviewBody })
  .strict();
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;

/** `PATCH /reviews/:id`. Once, within 7 days. */
export const UpdateReviewRequestSchema = z.object(reviewBody).strict();
export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequestSchema>;

/** The patient's own review, in any state, with what they may still do. */
export const MyReviewSchema = z.object({
  id: ObjectIdSchema,
  appointmentId: ObjectIdSchema,
  doctorId: ObjectIdSchema,
  ratings: ReviewRatingsSchema,
  wouldRecommend: WouldRecommendSchema,
  reason: VisitReasonSchema,
  text: z.string().nullable(),
  waitedMinutes: z.number().int().nullable(),
  /** `pending_checks` or `held_for_review` shows "being checked". */
  state: ReviewStateSchema,
  submittedAt: IsoDateTimeSchema,
  editedAt: IsoDateTimeSchema.nullable(),
  /** Until when the patient can still edit; `null` once used or past. */
  canEditUntil: IsoDateTimeSchema.nullable(),
});
export type MyReview = z.infer<typeof MyReviewSchema>;

export const MyReviewResponseSchema = z.object({ review: MyReviewSchema });
export type MyReviewResponse = z.infer<typeof MyReviewResponseSchema>;

// ---------------------------------------------------------------- public list

/** A published review as the public sees it: first name and last initial only. */
export const PublicReviewSchema = z.object({
  id: ObjectIdSchema,
  /** First name and last initial, like `Asha D.`. */
  reviewerName: z.string(),
  ratings: ReviewRatingsSchema,
  wouldRecommend: WouldRecommendSchema,
  reason: VisitReasonSchema,
  text: z.string().nullable(),
  /** Month of the visit, `YYYY-MM`. */
  visitMonth: z.string().regex(/^\d{4}-\d{2}$/),
  /** An older review by a patient who has reviewed a later visit; it no longer counts. */
  earlierVisit: z.boolean(),
  reply: z.object({ text: z.string(), at: IsoDateTimeSchema }).nullable(),
  publishedAt: IsoDateTimeSchema,
});
export type PublicReview = z.infer<typeof PublicReviewSchema>;

export const DoctorReviewsQuerySchema = CursorQuerySchema.extend({
  sort: z.enum(['recent']).default('recent'),
}).strict();
export type DoctorReviewsQuery = z.input<typeof DoctorReviewsQuerySchema>;

export const DoctorReviewsPageSchema = pageSchema(PublicReviewSchema);
export type DoctorReviewsPage = z.infer<typeof DoctorReviewsPageSchema>;

/** Shows a name as first name and last initial: `Asha Devi` becomes `Asha D.`. */
export function reviewerDisplayName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Patient';
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : (first as string);
}

// ---------------------------------------------------------------- report

export const REPORT_REASONS = ['abusive', 'fake', 'personal_info', 'spam', 'other'] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

/** `POST /reviews/:id/report`: anyone signed in can flag a review for the admins. */
export const ReportReviewRequestSchema = z.object({ reason: ReportReasonSchema }).strict();
export type ReportReviewRequest = z.infer<typeof ReportReviewRequestSchema>;
