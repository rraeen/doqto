import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUSES,
  VISIT_REASONS,
  type AppointmentSource,
  type AppointmentStatus,
  type VisitReason,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Hashed 4-digit visit code (issued by BE-27 through INT's VisitCodes; checked by BE-16). */
@Schema({ _id: false })
export class VisitCodeDoc {
  @Prop({ required: true }) hash: string;
  @Prop() expiresAt?: Date;
  @Prop({ default: 0 }) attempts: number;
  @Prop() lockedUntil?: Date;
}
const VisitCodeDocSchema = SchemaFactory.createForClass(VisitCodeDoc);

@Schema({ _id: false })
export class StatusHistoryEntry {
  @Prop({ type: String, enum: APPOINTMENT_STATUSES, required: true }) status: AppointmentStatus;
  @Prop({ required: true }) at: Date;
  /** User who made the change; absent for jobs. */
  @Prop({ type: Types.ObjectId, ref: 'User' }) by?: Types.ObjectId;
  /** e.g. `moved before token 4: elderly`. */
  @Prop({ maxlength: 120 }) note?: string;
}
const StatusHistoryEntrySchema = SchemaFactory.createForClass(StatusHistoryEntry);

/** Bounded per DB doc 3.5 (< 15 entries); pushes keep the newest. */
export const STATUS_HISTORY_MAX = 14;

/** DB doc 3.5 `appointments`: booking, queue entry and visit proof in one document. */
@Schema({ collection: 'appointments', timestamps: true, strict: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true }) clinicId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientUserId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 80 }) patientName: string;
  @Prop({ required: true }) patientPhone: string;
  /** IST `YYYY-MM-DD`. */
  @Prop({ required: true }) date: string;
  @Prop() slotStart?: Date;
  @Prop() slotEnd?: Date;
  @Prop({ type: String, enum: APPOINTMENT_SOURCES, required: true }) source: AppointmentSource;
  @Prop({ type: String, enum: APPOINTMENT_STATUSES, required: true }) status: AppointmentStatus;
  @Prop() holdExpiresAt?: Date;
  @Prop() queueToken?: number;
  @Prop() effectiveTime?: Date;
  @Prop() checkInAt?: Date;
  @Prop() consultStartAt?: Date;
  @Prop() consultEndAt?: Date;
  @Prop({ type: VisitCodeDocSchema }) visitCode?: VisitCodeDoc;
  @Prop() visitVerifiedAt?: Date;
  @Prop() reviewUnlockAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Payment' }) paymentId?: Types.ObjectId;
  /** Doqto booking fee in paise, copied from the doctor when booked (later fee changes do not apply). */
  @Prop({ default: 0 }) bookingFee: number;
  /** Why the patient is visiting, from a fixed list (no clinical detail). */
  @Prop({ type: String, enum: VISIT_REASONS }) visitReason?: VisitReason;
  /**
   * The visit code, sealed (AES-GCM) so the patient who booked can see it again in the app. The
   * clinic only ever checks `visitCode.hash`; nothing but the owner's own read route opens this.
   */
  @Prop() visitCodeSealed?: string;
  /** How many times the patient moved the booking. */
  @Prop({ default: 0 }) rescheduleCount: number;
  @Prop() cancelledAt?: Date;
  @Prop({ maxlength: 200 }) cancelReason?: string;
  @Prop({ type: [StatusHistoryEntrySchema], default: [] }) statusHistory: StatusHistoryEntry[];
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
// Release-blocking: double-booking is impossible while the slot is held or booked.
AppointmentSchema.index(
  { doctorId: 1, slotStart: 1 },
  {
    name: 'doctor_slot_active_unique',
    unique: true,
    partialFilterExpression: {
      status: { $in: [...ACTIVE_APPOINTMENT_STATUSES] },
      slotStart: { $exists: true },
    },
  },
);
AppointmentSchema.index({ doctorId: 1, date: 1, status: 1, effectiveTime: 1 });
AppointmentSchema.index({ patientUserId: 1, date: -1 });
AppointmentSchema.index(
  { status: 1, holdExpiresAt: 1 },
  { partialFilterExpression: { status: 'pending_payment' } },
);
AppointmentSchema.index(
  { status: 1, reviewUnlockAt: 1 },
  { partialFilterExpression: { status: 'completed' } },
);
AppointmentSchema.index({ clinicId: 1, date: 1 });
// The patient's own lists (upcoming / past), newest slot first.
AppointmentSchema.index({ patientUserId: 1, status: 1, slotStart: -1 });
