import { CHAT_TEXT_MAX, type ChatSender } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** One message of the thread of a booking (patient and doctor). Text only. */
@Schema({ collection: 'chat_messages', timestamps: { createdAt: true, updatedAt: false } })
export class ChatMessageDoc {
  @Prop({ type: Types.ObjectId, ref: 'Appointment', required: true }) appointmentId: Types.ObjectId;
  /** Kept for the patient's account deletion and for access checks. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: String, enum: ['patient', 'doctor'], required: true }) from: ChatSender;
  @Prop({ required: true, trim: true, maxlength: CHAT_TEXT_MAX }) text: string;
  /** When the other side read it; absent while unread. */
  @Prop() readAt?: Date;

  createdAt: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessageDoc>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessageDoc);
ChatMessageSchema.index({ appointmentId: 1, createdAt: 1 });
ChatMessageSchema.index({ appointmentId: 1, from: 1, readAt: 1 });
ChatMessageSchema.index({ patientUserId: 1 });
