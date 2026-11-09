/**
 * Health records (contract v6): the patient's own reports, prescriptions and scans that they upload
 * to keep in one place. They are stored privately, shown only to the patient, and Doqto never reads,
 * parses or shares them (ADR 0007: Doqto itself holds no clinical data).
 */
import { z } from 'zod';
import {
  CursorQuerySchema,
  IsoDateTimeSchema,
  IstDateSchema,
  ObjectIdSchema,
  pageSchema,
} from './common';

export const RECORD_KINDS = [
  'lab',
  'discharge',
  'diagnostics',
  'opd',
  'prescription',
  'vaccination',
  'other',
] as const;
export const RecordKindSchema = z.enum(RECORD_KINDS);
export type RecordKind = z.infer<typeof RecordKindSchema>;

/** OP = outpatient visit, IP = admitted (inpatient). */
export const RECORD_VISIT_TYPES = ['OP', 'IP'] as const;
export const RecordVisitTypeSchema = z.enum(RECORD_VISIT_TYPES);
export type RecordVisitType = z.infer<typeof RecordVisitTypeSchema>;

export const RECORD_STATUSES = ['normal', 'follow_up', 'completed'] as const;
export const RecordStatusSchema = z.enum(RECORD_STATUSES);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const RECORD_TITLE_MIN = 2;
export const RECORD_TITLE_MAX = 120;
export const RECORD_NAME_MAX = 120;
/** Same limit as other private uploads (PDF, JPEG, PNG or WebP). */
export const RECORD_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const RECORD_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
/** A patient can keep this many records. */
export const RECORDS_MAX = 500;

export const HealthRecordSchema = z.object({
  id: ObjectIdSchema,
  kind: RecordKindSchema,
  visitType: RecordVisitTypeSchema,
  title: z.string(),
  /** The doctor who treated, as the patient typed it (free text, so it also covers other clinics). */
  doctorName: z.string(),
  facility: z.string(),
  /** The date of the visit or test, IST `YYYY-MM-DD`. */
  date: IstDateSchema,
  status: RecordStatusSchema,
  /** The Doqto booking it belongs to, when the patient linked one. */
  appointmentId: ObjectIdSchema.nullable(),
  file: z.object({
    name: z.string(),
    contentType: z.enum(RECORD_FILE_TYPES),
    sizeBytes: z.number().int().nonnegative(),
  }),
  createdAt: IsoDateTimeSchema,
});
export type HealthRecord = z.infer<typeof HealthRecordSchema>;

/**
 * `POST /me/records` is multipart: the `file` plus these text fields. Everything arrives as a
 * string, so dates and enums are checked here and the API turns them into a record.
 */
export const CreateRecordFieldsSchema = z
  .object({
    title: z.string().trim().min(RECORD_TITLE_MIN).max(RECORD_TITLE_MAX),
    kind: RecordKindSchema,
    visitType: RecordVisitTypeSchema,
    doctorName: z.string().trim().min(2).max(RECORD_NAME_MAX),
    facility: z.string().trim().max(RECORD_NAME_MAX).default(''),
    date: IstDateSchema,
    status: RecordStatusSchema.default('completed'),
    appointmentId: ObjectIdSchema.optional(),
  })
  .strict();
export type CreateRecordFields = z.input<typeof CreateRecordFieldsSchema>;

/** `GET /me/records`: filters are all optional; `kind` takes several, comma separated. */
export const RecordsQuerySchema = CursorQuerySchema.extend({
  /** Search in the title, doctor and facility. */
  q: z.string().trim().min(1).max(60).optional(),
  kind: z
    .string()
    .regex(new RegExp(`^(${RECORD_KINDS.join('|')})(,(${RECORD_KINDS.join('|')}))*$`))
    .optional(),
  visitType: RecordVisitTypeSchema.optional(),
  /** One doctor, or several separated by `|` (a doctor's name has none). */
  doctor: z.string().trim().min(1).max(RECORD_NAME_MAX * 5).optional(),
  from: IstDateSchema.optional(),
  to: IstDateSchema.optional(),
}).strict();
export type RecordsQuery = z.input<typeof RecordsQuerySchema>;

/** A page of records, newest visit first, with the facets the filter panel needs. */
export const HealthRecordsPageSchema = pageSchema(HealthRecordSchema).extend({
  /** How many records match the filters in all. */
  total: z.number().int().nonnegative(),
  /** Every doctor name across all of the patient's records, A to Z (for the doctor filter). */
  doctors: z.array(z.string()),
});
export type HealthRecordsPage = z.infer<typeof HealthRecordsPageSchema>;

/** `GET /me/records/:id/file`: a short-lived link to download the file. */
export const RecordFileLinkSchema = z.object({
  url: z.string().url(),
  expiresAt: IsoDateTimeSchema,
  fileName: z.string(),
  contentType: z.enum(RECORD_FILE_TYPES),
});
export type RecordFileLink = z.infer<typeof RecordFileLinkSchema>;
