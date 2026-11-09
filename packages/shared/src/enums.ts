/**
 * Enums from the DB doc (doqto-database-design.md). Exported once here and reused by
 * the API (Mongoose schemas, DTOs) and the web app. Never redefine these locally.
 */
import { z } from 'zod';

export const ROLES = ['patient', 'doctor', 'clinic_staff', 'admin'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
export const UserStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/** Phase 1 UI languages. The DB allows more later ("en, hi, ..."). */
export const LANGUAGES = ['en', 'hi'] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

/** `otps.purpose`: login OTP, or the walk-in check-in OTP (sprint 3, INT-08). */
export const OTP_PURPOSES = ['login', 'visit'] as const;
export const OtpPurposeSchema = z.enum(OTP_PURPOSES);
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>;

/** DB doc 3.5 `appointments.status`. */
export const APPOINTMENT_STATUSES = [
  'pending_payment',
  /** Paid; waiting for the doctor to accept the slot. */
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_consult',
  'completed',
  'no_show',
  'cancelled_by_patient',
  'cancelled_by_clinic',
  'expired',
] as const;
export const AppointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

/** Statuses that hold a slot (the unique partial index on `{ doctorId, slotStart }`). */
export const ACTIVE_APPOINTMENT_STATUSES = [
  'pending_payment',
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_consult',
] as const satisfies readonly AppointmentStatus[];

/** DB doc 3.5 `appointments.source`. */
export const APPOINTMENT_SOURCES = [
  'online',
  'walk_in',
  'whatsapp_manual',
  'phone_manual',
] as const;
export const AppointmentSourceSchema = z.enum(APPOINTMENT_SOURCES);
export type AppointmentSource = z.infer<typeof AppointmentSourceSchema>;

/** DB doc 3.6 `doctorStatus.state`. */
export const DOCTOR_STATES = [
  'not_started',
  'in_clinic',
  'running_late',
  'on_break',
  'done_for_day',
  'on_leave',
] as const;
export const DoctorStateSchema = z.enum(DOCTOR_STATES);
export type DoctorState = z.infer<typeof DoctorStateSchema>;

/** DB doc 3.2 `doctors.verification.status`. */
export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export const VerificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/** DB doc 3.8 `reviews.wouldRecommend`. */
export const WOULD_RECOMMEND = ['yes', 'no', 'unsure'] as const;
export const WouldRecommendSchema = z.enum(WOULD_RECOMMEND);
export type WouldRecommend = z.infer<typeof WouldRecommendSchema>;

/** DB doc 3.10 `payments.status`. */
export const PAYMENT_STATUSES = [
  'created',
  'paid',
  'failed',
  'refund_pending',
  'refunded',
] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** `PROVIDER_MODE` (TDD 13). Reported by `/health` so the web app can show the demo banner. */
export const PROVIDER_MODES = ['demo', 'live'] as const;
export const ProviderModeSchema = z.enum(PROVIDER_MODES);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;
