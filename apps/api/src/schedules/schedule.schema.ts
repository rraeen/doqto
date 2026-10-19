import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class WeeklyBlockDoc {
  /** 0 is Sunday. */
  @Prop({ required: true, min: 0, max: 6 }) day: number;
  @Prop({ required: true }) start: string;
  @Prop({ required: true }) end: string;
  @Prop({ required: true }) slotMinutes: number;
  @Prop({ default: 1 }) capacityPerSlot: number;
}
const WeeklyBlockDocSchema = SchemaFactory.createForClass(WeeklyBlockDoc);

@Schema({ _id: false })
export class TimeBlockDoc {
  @Prop({ required: true }) start: string;
  @Prop({ required: true }) end: string;
  @Prop({ required: true }) slotMinutes: number;
}
const TimeBlockDocSchema = SchemaFactory.createForClass(TimeBlockDoc);

@Schema({ _id: false })
export class ScheduleExceptionDoc {
  /** IST `YYYY-MM-DD`. */
  @Prop({ required: true }) date: string;
  @Prop({ type: String, enum: ['leave', 'custom'], required: true }) type: 'leave' | 'custom';
  @Prop({ type: [TimeBlockDocSchema], default: undefined }) blocks?: TimeBlockDoc[];
}
const ScheduleExceptionDocSchema = SchemaFactory.createForClass(ScheduleExceptionDoc);

/** DB doc 3.4 `schedules`: one per (doctor, clinic). Slots are computed on read, never stored. */
@Schema({ collection: 'schedules', timestamps: true, strict: true })
export class ScheduleEntity {
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true }) clinicId: Types.ObjectId;
  @Prop({ type: [WeeklyBlockDocSchema], default: [] }) weekly: WeeklyBlockDoc[];
  @Prop({ type: [ScheduleExceptionDocSchema], default: [] }) exceptions: ScheduleExceptionDoc[];
  @Prop({ default: 7 }) bookingWindowDays: number;
  @Prop({ default: 0.3, min: 0, max: 1 }) walkInShare: number;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleDocument = HydratedDocument<ScheduleEntity>;
export const ScheduleEntitySchema = SchemaFactory.createForClass(ScheduleEntity);
ScheduleEntitySchema.index({ doctorId: 1, clinicId: 1 }, { unique: true });
