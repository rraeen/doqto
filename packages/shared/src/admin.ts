/** Admin doctor verification (BE-09). Contract v1 (BE-05). Every decision is audit-logged. */
import { z } from 'zod';
import { CursorQuerySchema, IsoDateTimeSchema, ObjectIdSchema, PhoneSchema } from './common';
import { DoctorPrivateProfileSchema } from './doctors';
import { VerificationStatusSchema } from './enums';
import { SpecialtyKeySchema } from './specialties';

/** `GET /admin/doctors?status=pending&cursor=&limit=`, oldest submission first. */
export const AdminDoctorQueueQuerySchema = CursorQuerySchema.extend({
  status: VerificationStatusSchema.default('pending'),
});
export type AdminDoctorQueueQuery = z.input<typeof AdminDoctorQueueQuerySchema>;

export const AdminDoctorQueueItemSchema = z.object({
  id: ObjectIdSchema,
  name: z.string(),
  /** `null` if the account row is missing (should not happen; logged by the API). */
  phone: PhoneSchema.nullable(),
  city: z.string().nullable(),
  specialties: z.array(SpecialtyKeySchema),
  registration: z.object({ council: z.string(), number: z.string(), year: z.number().int() }),
  documentUploaded: z.boolean(),
  verificationStatus: VerificationStatusSchema,
  submittedAt: IsoDateTimeSchema,
});
export type AdminDoctorQueueItem = z.infer<typeof AdminDoctorQueueItemSchema>;

/** `GET /admin/doctors/:id`: full profile plus a 5-minute signed link to the registration scan. */
export const AdminDoctorDetailSchema = z.object({
  doctor: DoctorPrivateProfileSchema,
  phone: PhoneSchema.nullable(),
  /**
   * Opaque fingerprint of what the admin is looking at (name, registration, document, submission).
   * Send it back with the decision: if the doctor changed anything since, the API answers 409.
   */
  reviewToken: z.string().min(16).max(128),
  /** `null` when no document was uploaded. Expires after `documentUrlExpiresAt`. */
  documentUrl: z.string().url().nullable(),
  documentUrlExpiresAt: IsoDateTimeSchema.nullable(),
});
export type AdminDoctorDetail = z.infer<typeof AdminDoctorDetailSchema>;

/** `POST /admin/doctors/:id/verify`. Notes are required when rejecting and shown to the doctor. */
export const VerifyDoctorRequestSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    /** `reviewToken` from `GET /admin/doctors/:id`. */
    reviewToken: z.string().min(16).max(128),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.decision === 'approve' || (v.notes !== undefined && v.notes.length >= 5), {
    message: 'Explain the rejection in at least 5 characters',
    path: ['notes'],
  });
export type VerifyDoctorRequest = z.infer<typeof VerifyDoctorRequestSchema>;
