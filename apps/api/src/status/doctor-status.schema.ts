import { DEFAULT_CONSULT_MINUTES, DOCTOR_STATES, type DoctorState } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Kept 90 days; history lives in `statusEvents` (DB doc 3.6). */
export const DOCTOR_STATUS_TTL_SECONDS = 90 * 24 * 3600;

/** DB doc 3.6 `doctorStatus`: one small live document per doctor per day (the polled one). */
@Schema({ collection: 'doctorStatus', timestamps: true, strict: true })
export class DoctorStatusEntity {
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinic' }) clinicId?: Types.ObjectId;
  /** IST `YYYY-MM-DD`. */
  @Prop({ required: true }) date: string;
  @Prop({ type: String, enum: DOCTOR_STATES, default: 'not_started' }) state: DoctorState;
  @Prop({ default: 0 }) delayMinutes: number;
  @Prop() etaAt?: Date;
  @Prop({ maxlength: 80 }) message?: string;
  @Prop() currentToken?: number;
  @Prop({ default: 0 }) queueLength: number;
  /** Last token issued today; `$inc` at check-in, so tokens never repeat. */
  @Prop({ default: 0 }) tokenCounter: number;
  /** EWMA (weight 0.2), carried over from the previous day. */
  @Prop({ default: DEFAULT_CONSULT_MINUTES }) avgConsultMinutes: number;
  /** Short lock so two queue taps never interleave (BE-17). */
  @Prop() queueLockUntil?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;
  /** Set only by an explicit status update (`null` in the API until then). */
  @Prop() statusSetAt?: Date;
  /** BE-22: the delay patients were last alerted about today (alerts again at +15 minutes). */
  @Prop() alertedDelayMinutes?: number;

  createdAt: Date;
  updatedAt: Date;
}

export type DoctorStatusDocument = HydratedDocument<DoctorStatusEntity>;
export const DoctorStatusEntitySchema = SchemaFactory.createForClass(DoctorStatusEntity);
DoctorStatusEntitySchema.index({ doctorId: 1, date: 1 }, { unique: true });
DoctorStatusEntitySchema.index({ createdAt: 1 }, { expireAfterSeconds: DOCTOR_STATUS_TTL_SECONDS });
