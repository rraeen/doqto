/**
 * Clinic console: day sheet, manual and walk-in entries, check-in and queue actions
 * (TDD 6.2, DB doc 3.5). Contract v2 (BE-12). Every route needs the doctor or that clinic's
 * staff; requests name the clinic and doctor because one clinic can have several doctors.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, IstDateSchema, ObjectIdSchema, PhoneSchema } from './common';
import { AppointmentSourceSchema, AppointmentStatusSchema, DoctorStateSchema } from './enums';
import { DoctorStatusSchema } from './status';

/** `GET /clinic/appointments?clinicId=&doctorId=&date=`; `date` defaults to today in IST. */
export const DaySheetQuerySchema = z.object({
  clinicId: ObjectIdSchema,
  doctorId: ObjectIdSchema.optional(),
  date: IstDateSchema.optional(),
});
export type DaySheetQuery = z.infer<typeof DaySheetQuerySchema>;

/** One row of the front-desk day sheet. Staff see the patient phone; patients never see others. */
export const DaySheetItemSchema = z.object({
  id: ObjectIdSchema,
  doctorId: ObjectIdSchema,
  clinicId: ObjectIdSchema,
  patientName: z.string(),
  patientPhone: PhoneSchema,
  date: IstDateSchema,
  slotStart: IsoDateTimeSchema.nullable(),
  slotEnd: IsoDateTimeSchema.nullable(),
  source: AppointmentSourceSchema,
  status: AppointmentStatusSchema,
  queueToken: z.number().int().positive().nullable(),
  /** Queue order key: slot start if on time (10 minutes grace), else check-in time. */
  effectiveTime: IsoDateTimeSchema.nullable(),
  checkInAt: IsoDateTimeSchema.nullable(),
  consultStartAt: IsoDateTimeSchema.nullable(),
  consultEndAt: IsoDateTimeSchema.nullable(),
  visitVerified: z.boolean(),
  /** Online bookings carry a 4-digit visit code; other entries check in with an OTP. */
  hasVisitCode: z.boolean(),
  /** The patient moved this booking to a new time at least once. */
  rescheduled: z.boolean().optional(),
  createdAt: IsoDateTimeSchema,
});
export type DaySheetItem = z.infer<typeof DaySheetItemSchema>;

/**
 * Sorted for the front desk: in consult, then the waiting queue by effective time, then
 * booked but not arrived by slot, then finished, no-show and cancelled.
 */
export const DaySheetResponseSchema = z.object({
  date: IstDateSchema,
  items: z.array(DaySheetItemSchema),
  /** Live status of the doctor, when `doctorId` was given. */
  status: DoctorStatusSchema.nullable(),
});
export type DaySheetResponse = z.infer<typeof DaySheetResponseSchema>;

export const MANUAL_SOURCES = ['walk_in', 'whatsapp_manual', 'phone_manual'] as const;
export const ManualSourceSchema = z.enum(MANUAL_SOURCES);

/**
 * `POST /clinic/appointments`: walk-in or a booking taken over WhatsApp or phone, no fee.
 * Walk-ins are for today and have no slot. Manual bookings take `date` and optionally a
 * `slotStart` that must match a slot in the schedule. The patient account is matched by phone
 * or created.
 */
export const CreateClinicAppointmentRequestSchema = z
  .object({
    clinicId: ObjectIdSchema,
    doctorId: ObjectIdSchema,
    source: ManualSourceSchema,
    patientName: z.string().trim().min(1).max(80),
    patientPhone: PhoneSchema,
    date: IstDateSchema.optional(),
    slotStart: IsoDateTimeSchema.optional(),
  })
  .strict()
  .refine((r) => r.source !== 'walk_in' || r.slotStart === undefined, {
    message: 'Walk-ins have no slot',
    path: ['slotStart'],
  });
export type CreateClinicAppointmentRequest = z.infer<typeof CreateClinicAppointmentRequestSchema>;

export const CHECK_IN_METHODS = ['visit_code', 'otp'] as const;

/**
 * `POST /clinic/queue/check-in`. `visit_code`: the 4-digit code from the booking (5 wrong tries
 * lock it for 15 minutes). `otp`: the 6-digit code sent by `POST /clinic/queue/:id/send-otp` to
 * the patient's phone (walk-ins and manual bookings). Demo mode also accepts 123456.
 */
export const CheckInRequestSchema = z
  .object({
    appointmentId: ObjectIdSchema,
    method: z.enum(CHECK_IN_METHODS),
    code: z.string().regex(/^\d{4,6}$/, 'Expected the 4-digit visit code or 6-digit OTP'),
  })
  .strict();
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;

/** `POST /clinic/queue/:appointmentId/send-otp` response. */
export const SendVisitOtpResponseSchema = z.object({
  expiresAt: IsoDateTimeSchema,
  channel: z.enum(['whatsapp', 'sms', 'demo']),
});
export type SendVisitOtpResponse = z.infer<typeof SendVisitOtpResponseSchema>;

/**
 * `POST /clinic/queue/next`: completes the patient in consult (if any) and calls the next by
 * effective time. `currentAppointmentId` guards double taps: when given and it is no longer the
 * one in consult, the API answers `409 CONFLICT` and changes nothing (`null` means "nobody is in
 * consult").
 */
export const QueueNextRequestSchema = z
  .object({
    clinicId: ObjectIdSchema,
    doctorId: ObjectIdSchema,
    currentAppointmentId: ObjectIdSchema.nullable().optional(),
  })
  .strict();
export type QueueNextRequest = z.infer<typeof QueueNextRequestSchema>;

/** `POST /clinic/queue/:appointmentId/move`: put this patient right before another waiting one. */
export const QueueMoveRequestSchema = z
  .object({ beforeAppointmentId: ObjectIdSchema, reason: z.string().trim().max(80).optional() })
  .strict();
export type QueueMoveRequest = z.infer<typeof QueueMoveRequestSchema>;

/** Response of check-in and every queue action: the changed entry plus the doctor's live status. */
export const QueueActionResponseSchema = z.object({
  appointment: DaySheetItemSchema.nullable(),
  /** For `next`: the entry just completed, if any. */
  completed: DaySheetItemSchema.nullable(),
  status: DoctorStatusSchema,
});
export type QueueActionResponse = z.infer<typeof QueueActionResponseSchema>;

/** Wait shown as a range, about 20% either side (TDD 6.3). */
export const WaitRangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});
export type WaitRange = z.infer<typeof WaitRangeSchema>;

/** `GET /appointments/:id/position` (the patient, or that clinic's doctor and staff). */
export const AppointmentPositionSchema = z.object({
  appointmentId: ObjectIdSchema,
  status: AppointmentStatusSchema,
  queueToken: z.number().int().positive().nullable(),
  currentToken: z.number().int().nonnegative().nullable(),
  /** Patients who will be seen first, counting the one in consult. `null` once seen or closed. */
  tokensAhead: z.number().int().nonnegative().nullable(),
  estimatedWaitMinutes: WaitRangeSchema.nullable(),
  doctorState: DoctorStateSchema,
  delayMinutes: z.number().int().nonnegative(),
  updatedAt: IsoDateTimeSchema,
});
export type AppointmentPosition = z.infer<typeof AppointmentPositionSchema>;
