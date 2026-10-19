import { DOCTOR_STATES, type DoctorState } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Kept 12 months (DB doc 3.7). */
export const STATUS_EVENT_TTL_SECONDS = 365 * 24 * 3600;

/** DB doc 3.7 `statusEvents`: append-only log of doctor status changes. */
@Schema({ collection: 'statusEvents', strict: true, timestamps: false })
export class StatusEvent {
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true }) clinicId: Types.ObjectId;
  @Prop({ required: true }) date: string;
  @Prop({ type: String, enum: DOCTOR_STATES, required: true }) from: DoctorState;
  @Prop({ type: String, enum: DOCTOR_STATES, required: true }) to: DoctorState;
  @Prop({ default: 0 }) delayMinutes: number;
  @Prop({ type: Types.ObjectId, ref: 'User' }) by?: Types.ObjectId;
  @Prop({ required: true, default: () => new Date() }) at: Date;
}

export type StatusEventDocument = HydratedDocument<StatusEvent>;
export const StatusEventSchema = SchemaFactory.createForClass(StatusEvent);
StatusEventSchema.index({ doctorId: 1, date: 1, at: 1 });
// "Kept 12 months, then archived or dropped": dropped by TTL until an archive exists.
StatusEventSchema.index({ at: 1 }, { expireAfterSeconds: STATUS_EVENT_TTL_SECONDS });
