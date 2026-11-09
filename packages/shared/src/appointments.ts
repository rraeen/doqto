/**
 * Appointment shapes (DB doc 3.5). The patient's view of one appointment, plus the booking
 * schemas of contract v3 (slots, create with a 10-minute hold, pay, my appointments, cancel).
 * The visit code is never part of `Appointment`; it is returned once, when payment confirms.
 */
import { z } from 'zod';
import {
  CursorQuerySchema,
  IsoDateTimeSchema,
  IstDateSchema,
  ObjectIdSchema,
  PaiseSchema,
  PhoneSchema,
} from './common';
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

// ---------------------------------------------------------------- contract v3: booking

/** Booking hold while the patient pays (TDD section 8). */
export const HOLD_MINUTES = 10;
/** Cancelling at least this long before the slot refunds in full. */
export const FULL_REFUND_HOURS = 2;
/** A doctor running at least this late lets the patient cancel for a full refund. */
export const LATE_REFUND_MINUTES = 60;
export const PATIENT_NAME_MIN = 2;
export const PATIENT_NAME_MAX = 80;

/** One free slot, computed on read from the schedule minus bookings (`GET /doctors/:id/slots`). */
export const SlotSchema = z.object({ start: IsoDateTimeSchema, end: IsoDateTimeSchema });
export type Slot = z.infer<typeof SlotSchema>;

export const SlotsQuerySchema = z
  .object({ clinicId: ObjectIdSchema, date: IstDateSchema })
  .strict();
export type SlotsQuery = z.input<typeof SlotsQuerySchema>;

export const SlotsResponseSchema = z.object({
  date: IstDateSchema,
  clinicId: ObjectIdSchema,
  /** Free slots, earliest first. Empty with `scheduled: true` means fully booked. */
  slots: z.array(SlotSchema),
  /** `false` when the doctor does not see patients at this clinic on this date. */
  scheduled: z.boolean(),
  /** Doqto booking fee in paise. */
  bookingFee: PaiseSchema,
});
export type SlotsResponse = z.infer<typeof SlotsResponseSchema>;

/** Why the patient is visiting. A short list of choices, never free text (no clinical data). */
export const VISIT_REASONS = ['checkup', 'follow_up', 'child', 'women', 'other'] as const;
export const VisitReasonSchema = z.enum(VISIT_REASONS);
export type VisitReason = z.infer<typeof VisitReasonSchema>;

/** `POST /appointments`. The patient may book for someone else (name and phone of the visitor). */
export const CreateAppointmentRequestSchema = z
  .object({
    doctorId: ObjectIdSchema,
    clinicId: ObjectIdSchema,
    slotStart: IsoDateTimeSchema,
    patientName: z.string().trim().min(PATIENT_NAME_MIN).max(PATIENT_NAME_MAX),
    patientPhone: PhoneSchema,
    reason: VisitReasonSchema.optional(),
  })
  .strict();
export type CreateAppointmentRequest = z.infer<typeof CreateAppointmentRequestSchema>;

export const PAYMENT_PROVIDERS = ['demo', 'razorpay'] as const;
export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export type PaymentProviderName = z.infer<typeof PaymentProviderSchema>;

export const PaymentOrderSchema = z.object({
  provider: PaymentProviderSchema,
  orderId: z.string().min(1),
  amount: PaiseSchema,
  currency: z.literal('INR'),
  /** Razorpay public key id for Checkout; `null` in demo mode. */
  keyId: z.string().nullable(),
});
export type PaymentOrder = z.infer<typeof PaymentOrderSchema>;

/** The held appointment (`pending_payment`) and the order to pay. 409 `SLOT_TAKEN` if lost. */
export const CreateAppointmentResponseSchema = z.object({
  appointment: AppointmentSchema,
  order: PaymentOrderSchema,
});
export type CreateAppointmentResponse = z.infer<typeof CreateAppointmentResponseSchema>;

/** Demo mode: the "Pay (demo)" button. Drives the same path as the payment webhook. */
export const DemoPayRequestSchema = z.object({ appointmentId: ObjectIdSchema }).strict();
export type DemoPayRequest = z.infer<typeof DemoPayRequestSchema>;

/** Razorpay Checkout result, checked by the API against the key secret. */
export const VerifyPaymentRequestSchema = z
  .object({
    appointmentId: ObjectIdSchema,
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  })
  .strict();
export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentRequestSchema>;

/**
 * Result of a successful payment. The booking now waits for the doctor (`pending_confirmation`);
 * the visit code is created only when the doctor confirms the slot.
 */
export const PaymentResultSchema = z.object({ appointment: AppointmentSchema });
export type PaymentResult = z.infer<typeof PaymentResultSchema>;

/**
 * The booking reference the patient can quote at the clinic, like `DQ-A1B2C3`: the last 6
 * letters or digits of the appointment id. The web app and the API both derive it, so it is
 * never stored.
 */
export function appointmentReference(id: string): string {
  return `DQ-${id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase()}`;
}

/** `POST /clinic/appointments/:id/confirm`: the doctor accepts a paid booking. */
export const ConfirmAppointmentResponseSchema = z.object({ appointment: AppointmentSchema });
export type ConfirmAppointmentResponse = z.infer<typeof ConfirmAppointmentResponseSchema>;

/** An appointment with the doctor and clinic it belongs to, for the "my appointments" list. */
export const MyAppointmentSchema = AppointmentSchema.extend({
  doctor: z.object({
    id: ObjectIdSchema,
    name: z.string(),
    slug: z.string(),
    specialties: z.array(z.string()),
    /** The doctor's approved profile photo, if any. */
    photoUrl: z.string().nullable().optional(),
  }),
  clinic: z.object({ id: ObjectIdSchema, name: z.string(), area: z.string().nullable() }),
  /** Doqto booking fee in paise. */
  bookingFee: PaiseSchema,
  /**
   * The 4-digit code to show at the front desk. Only the patient who booked sees it, and only
   * once the doctor has confirmed; `null` before that and after the visit is closed.
   */
  visitCode: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  /**
   * The order to pay, only while the booking is `pending_payment`, so a patient who reloads or
   * comes back from the list can still pay (the `order` of the create response is not kept).
   */
  order: PaymentOrderSchema.nullable().optional(),
});
export type MyAppointment = z.infer<typeof MyAppointmentSchema>;

export const MyAppointmentsQuerySchema = CursorQuerySchema.extend({
  tab: z.enum(['upcoming', 'past']).optional(),
}).strict();
export type MyAppointmentsQuery = z.input<typeof MyAppointmentsQuerySchema>;

export const CANCEL_REASONS = [
  'change_of_plan',
  'booked_by_mistake',
  'doctor_unavailable',
  'other',
] as const;
export const CancelReasonSchema = z.enum(CANCEL_REASONS);
export type CancelReason = z.infer<typeof CancelReasonSchema>;

export const CancelAppointmentRequestSchema = z
  .object({ reason: CancelReasonSchema.optional() })
  .strict();
export type CancelAppointmentRequest = z.infer<typeof CancelAppointmentRequestSchema>;

export const RefundOutcomeSchema = z.object({
  kind: z.enum(['full', 'none']),
  /** Paise returned to the patient. */
  amount: PaiseSchema,
});
export type RefundOutcome = z.infer<typeof RefundOutcomeSchema>;

export const CancelAppointmentResponseSchema = z.object({
  appointment: AppointmentSchema,
  refund: RefundOutcomeSchema,
});
export type CancelAppointmentResponse = z.infer<typeof CancelAppointmentResponseSchema>;

/**
 * Refund rule for a patient who cancels (TDD section 8). The API is the authority; the web app
 * uses the same function to tell the patient what will happen before they confirm.
 * - Not paid yet (`pending_payment`): nothing was charged, so nothing to refund.
 * - Paid but the doctor has not confirmed (`pending_confirmation`): full refund, always.
 * - Confirmed: 2 or more hours before the slot, or the doctor is 60+ minutes late, full refund;
 *   under 2 hours before the slot, no refund.
 */
export function refundForPatientCancel(input: {
  status: z.infer<typeof AppointmentStatusSchema>;
  slotStart: string | null;
  bookingFee: number;
  now: number;
  doctorLateMinutes?: number;
}): RefundOutcome {
  const none: RefundOutcome = { kind: 'none', amount: 0 };
  const full: RefundOutcome = { kind: 'full', amount: input.bookingFee };
  if (input.status === 'pending_confirmation') return full;
  if (input.status !== 'confirmed') return none;
  if ((input.doctorLateMinutes ?? 0) >= LATE_REFUND_MINUTES) return full;
  if (!input.slotStart) return none;
  const hoursAhead = (Date.parse(input.slotStart) - input.now) / 3_600_000;
  return hoursAhead >= FULL_REFUND_HOURS ? full : none;
}

/**
 * `POST /appointments/:id/reschedule`: moves a paid booking to another free slot. The fee
 * already paid carries over and the visit code (if any) stays the same; the old slot is released.
 * 409 `SLOT_TAKEN` if the new slot was lost.
 */
export const RescheduleAppointmentRequestSchema = z
  .object({ slotStart: IsoDateTimeSchema })
  .strict();
export type RescheduleAppointmentRequest = z.infer<typeof RescheduleAppointmentRequestSchema>;

export const RescheduleAppointmentResponseSchema = z.object({ appointment: AppointmentSchema });
export type RescheduleAppointmentResponse = z.infer<typeof RescheduleAppointmentResponseSchema>;

/** A booking can be moved up to this long before its slot. */
export const RESCHEDULE_MIN_HOURS = FULL_REFUND_HOURS;

/**
 * Whether the patient may still change the time: a paid booking (waiting for the doctor, or
 * confirmed), and only while the slot is at least `RESCHEDULE_MIN_HOURS` away (the same cut-off
 * as a full refund). A booking waiting for the doctor stays waiting at its new time, and a confirmed
 * one goes back to waiting: the doctor must accept the new time (a new visit code follows).
 */
export function canReschedule(input: {
  status: z.infer<typeof AppointmentStatusSchema>;
  slotStart: string | null;
  now: number;
}): boolean {
  if (!['pending_confirmation', 'confirmed'].includes(input.status) || !input.slotStart) {
    return false;
  }
  return (Date.parse(input.slotStart) - input.now) / 3_600_000 >= RESCHEDULE_MIN_HOURS;
}
