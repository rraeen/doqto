import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** DB doc 3.12 `auditLogs`: append-only record of admin and other sensitive actions. */
@Schema({ collection: 'auditLogs', strict: true, timestamps: false })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) actorUserId: Types.ObjectId;
  /** e.g. `doctor.verify.approve`. */
  @Prop({ required: true }) action: string;
  /** Collection name, e.g. `doctors`. */
  @Prop({ required: true }) entity: string;
  @Prop({ type: Types.ObjectId, required: true }) entityId: Types.ObjectId;
  @Prop({ type: Object }) before?: Record<string, unknown>;
  @Prop({ type: Object }) after?: Record<string, unknown>;
  @Prop({ required: true, default: () => new Date() }) at: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ actorUserId: 1, at: -1 });
// DB doc 6: kept 24 months (added in migration 0003).
AuditLogSchema.index({ at: 1 }, { expireAfterSeconds: 730 * 24 * 3600 });
