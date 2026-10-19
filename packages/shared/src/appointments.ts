/**
 * Appointment shapes (DB doc 3.5). PLACEHOLDER in contract v0: the patient's view of one
 * appointment. Create, cancel, day sheet and check-in schemas arrive in contracts v2 and v3.
 * The visit code is never returned here (only once, on the booking confirmed screen).
 */
import { z } from 'zod';
import { IsoDateTimeSchema, IstDateSchema, ObjectIdSchema } from './common';
import { AppointmentSourceSchema, AppointmentStatusSchema } from './enums';

export const AppointmentSchema = z.object({
  id: ObjectIdSchema,
  doctorId: ObjectIdSchema,
  clinicId: ObjectIdSchema,
  patientName: z.string(),
  date: IstDateSchema,
  /** `null` for pure walk-ins. */
  slotStart: IsoDateTimeSchema.nullable(),
  slotEnd: IsoDateTimeSchema.nullable(),
  source: AppointmentSourceSchema,
  status: AppointmentStatusSchema,
  /** Only while `pending_payment` (10-minute hold). */
  holdExpiresAt: IsoDateTimeSchema.nullable(),
  /** Assigned at check-in. */
  queueToken: z.number().int().positive().nullable(),
  checkInAt: IsoDateTimeSchema.nullable(),
  visitVerified: z.boolean(),
  reviewUnlockAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Appointment = z.infer<typeof AppointmentSchema>;
