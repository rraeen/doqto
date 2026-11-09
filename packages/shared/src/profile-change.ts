/**
 * The doctor's own profile in the console, and the review of changes to it. A doctor edits the
 * details patients see (and the photo); the edit is kept as a pending change and patients keep
 * seeing the approved profile until the Doqto team approves the change. Contract v6.15.0.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, ObjectIdSchema } from './common';


export const ProfileChangeStatusSchema = z.enum(['pending', 'rejected']);
export type ProfileChangeStatus = z.infer<typeof ProfileChangeStatusSchema>;

/** The profile answers (the clinic form of `unit-forms.ts`) and the photo that goes with them. */
export const ProfileSnapshotSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
  photoUrl: z.string().nullable(),
});
export type ProfileSnapshot = z.infer<typeof ProfileSnapshotSchema>;

export const PendingProfileChangeSchema = ProfileSnapshotSchema.extend({
  status: ProfileChangeStatusSchema,
  /** Why Doqto turned it down; only for `rejected`. */
  reviewNote: z.string().nullable(),
  submittedAt: IsoDateTimeSchema,
  /** The form fields that differ from the approved profile. */
  changedFields: z.array(z.string()),
  photoChanged: z.boolean(),
});
export type PendingProfileChange = z.infer<typeof PendingProfileChangeSchema>;

/** `GET /console/workspaces/:id/profile`: what patients see now and what waits for approval. */
export const MyProfileSchema = z.object({
  current: ProfileSnapshotSchema,
  pending: PendingProfileChangeSchema.nullable(),
  /** Whether patients can find the profile now. */
  listed: z.boolean(),
});
export type MyProfile = z.infer<typeof MyProfileSchema>;

/** `PUT /console/workspaces/:id/profile`: the whole form, as in the application. */
export const SaveProfileRequestSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
});
export type SaveProfileRequest = z.infer<typeof SaveProfileRequestSchema>;

// ---- the Doqto team's review

export const ProfileChangeSummarySchema = z.object({
  /** The id of the service (unit) the change belongs to. */
  id: ObjectIdSchema,
  name: z.string(),
  submittedAt: IsoDateTimeSchema,
  changedFields: z.array(z.string()),
  photoChanged: z.boolean(),
  applicant: z.object({
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
});
export type ProfileChangeSummary = z.infer<typeof ProfileChangeSummarySchema>;

export const ProfileChangeListSchema = z.object({ items: z.array(ProfileChangeSummarySchema) });
export type ProfileChangeList = z.infer<typeof ProfileChangeListSchema>;

export const ProfileChangeDetailSchema = ProfileChangeSummarySchema.extend({
  current: ProfileSnapshotSchema,
  proposed: ProfileSnapshotSchema,
});
export type ProfileChangeDetail = z.infer<typeof ProfileChangeDetailSchema>;

export const PROFILE_CHANGE_DECISIONS = ['approve', 'reject'] as const;
export const ProfileChangeDecisionRequestSchema = z.object({
  decision: z.enum(PROFILE_CHANGE_DECISIONS),
  /** Required (5+ characters) when rejecting. */
  note: z.string().trim().max(1000).optional(),
});
export type ProfileChangeDecisionRequest = z.infer<typeof ProfileChangeDecisionRequestSchema>;
