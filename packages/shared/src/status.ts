/**
 * Live doctor status (DB doc 3.6). Final in contract v2 (BE-12, BE-18).
 * `GET /doctors/:id/status` is public and cached at the edge for 15 s: it never carries patient data.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, IstDateSchema, ObjectIdSchema } from './common';
import { DoctorStateSchema } from './enums';

export const STATUS_MESSAGE_MAX = 80;
export const DELAY_MINUTES_MAX = 300;
/** TDD 6.3: new doctors start at 8 minutes per consult. */
export const DEFAULT_CONSULT_MINUTES = 8;

export const DoctorStatusSchema = z.object({
  doctorId: ObjectIdSchema,
  clinicId: ObjectIdSchema.nullable(),
  date: IstDateSchema,
  state: DoctorStateSchema,
  delayMinutes: z.number().int().nonnegative(),
  /** When the doctor is expected (set for `running_late`, or by staff). */
  etaAt: IsoDateTimeSchema.nullable(),
  message: z.string().max(STATUS_MESSAGE_MAX).nullable(),
  /** Token now with the doctor; `null` before the first patient is called. */
  currentToken: z.number().int().nonnegative().nullable(),
  /** Patients checked in and waiting (not counting the one in consult). */
  queueLength: z.number().int().nonnegative(),
  /** `null` while no status document exists for today (the default `not_started`). */
  updatedAt: IsoDateTimeSchema.nullable(),
});
export type DoctorStatus = z.infer<typeof DoctorStatusSchema>;

/**
 * `PUT /clinic/status` (doctor or that clinic's staff). `delayMinutes` is required for
 * `running_late`. `etaAt` defaults to the day's first scheduled start plus the delay.
 */
export const UpdateStatusRequestSchema = z
  .object({
    clinicId: ObjectIdSchema,
    doctorId: ObjectIdSchema,
    state: DoctorStateSchema,
    delayMinutes: z.number().int().min(0).max(DELAY_MINUTES_MAX).optional(),
    etaAt: IsoDateTimeSchema.optional(),
    message: z.string().trim().max(STATUS_MESSAGE_MAX).nullable().optional(),
  })
  .strict()
  .refine((s) => s.state !== 'running_late' || (s.delayMinutes ?? 0) > 0, {
    message: 'delayMinutes is required when running late',
    path: ['delayMinutes'],
  });
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>;
