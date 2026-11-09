import {
  RECORD_KINDS,
  RECORD_STATUSES,
  RECORD_VISIT_TYPES,
  type RecordKind,
  type RecordStatus,
  type RecordVisitType,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class RecordFile {
  /** Private object key (`records/<userId>/<recordId>.<ext>`); never sent to the client. */
  @Prop({ required: true }) key: string;
  @Prop({ required: true, maxlength: 200 }) name: string;
  @Prop({ required: true }) contentType: string;
  @Prop({ required: true }) sizeBytes: number;
}
const RecordFileSchema = SchemaFactory.createForClass(RecordFile);

/**
 * A record the patient uploaded to keep their own papers together (contract v6). Stored privately
 * and visible only to the owner; Doqto never reads the file (ADR 0007).
 */
@Schema({ collection: 'healthRecords', timestamps: true, strict: true })
export class HealthRecordDoc {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: String, enum: RECORD_KINDS, required: true }) kind: RecordKind;
  @Prop({ type: String, enum: RECORD_VISIT_TYPES, required: true }) visitType: RecordVisitType;
  @Prop({ required: true, trim: true, maxlength: 120 }) title: string;
  @Prop({ required: true, trim: true, maxlength: 120 }) doctorName: string;
  @Prop({ default: '', trim: true, maxlength: 120 }) facility: string;
  /** IST `YYYY-MM-DD`. */
  @Prop({ required: true }) date: string;
  @Prop({ type: String, enum: RECORD_STATUSES, default: 'completed' }) status: RecordStatus;
  @Prop({ type: Types.ObjectId, ref: 'Appointment' }) appointmentId?: Types.ObjectId;
  @Prop({ type: RecordFileSchema, required: true }) file: RecordFile;
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type HealthRecordDocument = HydratedDocument<HealthRecordDoc>;
export const HealthRecordSchema = SchemaFactory.createForClass(HealthRecordDoc);
// The list: one patient's records, newest visit first.
HealthRecordSchema.index({ userId: 1, date: -1, _id: -1 });
