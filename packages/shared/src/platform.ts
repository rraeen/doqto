/**
 * The Doqto team's review of applications from doctors, clinics, labs and pharmacies. The team uses
 * the same console app and the same sign-in as everyone else; what they see depends on their role
 * (`ConsoleAccount.platformRole`), and the API checks the role on every request.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, ObjectIdSchema } from './common';
import { UnitStatusSchema, WorkspaceTypeSchema } from './console-auth';

const ApplicantSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

/** One application (a service a provider applied for) in the review list. */
export const ApplicationSummarySchema = z.object({
  /** The unit id. */
  id: ObjectIdSchema,
  kind: WorkspaceTypeSchema,
  /** The name given in the form (clinic, lab or store name). */
  name: z.string(),
  status: UnitStatusSchema,
  submittedAt: IsoDateTimeSchema.nullable(),
  reviewedAt: IsoDateTimeSchema.nullable(),
  applicant: ApplicantSchema,
});
export type ApplicationSummary = z.infer<typeof ApplicationSummarySchema>;

const count = z.number().int().nonnegative();
/** How many applications are in each status, whatever filter the list used. */
export const ApplicationCountsSchema = z.object({
  draft: count,
  pending: count,
  changes_requested: count,
  verified: count,
  rejected: count,
  suspended: count,
});
export type ApplicationCounts = z.infer<typeof ApplicationCountsSchema>;

export const ApplicationListSchema = z.object({
  items: z.array(ApplicationSummarySchema),
  counts: ApplicationCountsSchema,
});
export type ApplicationList = z.infer<typeof ApplicationListSchema>;

/** One application in full: the form answers and the other services of the same business. */
export const ApplicationDetailSchema = ApplicationSummarySchema.extend({
  profile: z.record(z.string(), z.unknown()),
  /** What the reviewer told the applicant last time (changes requested or rejected). */
  reviewNote: z.string().nullable(),
  organization: z.object({ id: ObjectIdSchema, name: z.string() }),
  /** Other services applied for by the same business, for example the lab of a clinic. */
  siblings: z.array(
    z.object({
      id: ObjectIdSchema,
      kind: WorkspaceTypeSchema,
      name: z.string(),
      status: UnitStatusSchema,
    }),
  ),
});
export type ApplicationDetail = z.infer<typeof ApplicationDetailSchema>;

export const APPLICATION_DECISIONS = ['approve', 'request_changes', 'reject'] as const;
export const NOTE_MIN_LENGTH = 5;

/** `POST /platform/applications/:id/decision`. Sending back or rejecting needs a reason. */
export const ApplicationDecisionRequestSchema = z
  .object({
    decision: z.enum(APPLICATION_DECISIONS),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => v.decision === 'approve' || (v.note?.length ?? 0) >= NOTE_MIN_LENGTH, {
    message: `Tell the applicant why (at least ${NOTE_MIN_LENGTH} characters)`,
    path: ['note'],
  });
export type ApplicationDecisionRequest = z.infer<typeof ApplicationDecisionRequestSchema>;
