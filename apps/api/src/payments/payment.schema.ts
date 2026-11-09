import { PAYMENT_STATUSES, PAYMENT_PROVIDERS, type PaymentStatus } from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class RefundInfo {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) amount: number;
  @Prop({ required: true }) reason: string;
  @Prop({ required: true }) at: Date;
}
const RefundInfoSchema = SchemaFactory.createForClass(RefundInfo);

/** DB doc 3.10 `payments`: one booking-fee payment per appointment. Amounts are paise. */
@Schema({ collection: 'payments', timestamps: true, strict: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Appointment', required: true }) appointmentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientUserId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) amount: number;
  @Prop({ default: 'INR' }) currency: string;
  @Prop({ default: 'booking_fee' }) purpose: string;
  @Prop({ type: String, enum: PAYMENT_PROVIDERS, required: true }) gateway: 'demo' | 'razorpay';
  @Prop({ required: true }) gatewayOrderId: string;
  @Prop() gatewayPaymentId?: string;
  @Prop({ default: false }) signatureVerified: boolean;
  @Prop({ type: String, enum: PAYMENT_STATUSES, default: 'created' }) status: PaymentStatus;
  @Prop({ type: RefundInfoSchema }) refund?: RefundInfo;
  /** Why a refund is owed but the gateway call has not gone through yet (the job retries it). */
  @Prop() refundOwedReason?: string;
  /** Gateway event ids already applied: gateways retry webhooks, so each is applied once. */
  @Prop({ type: [String], default: [] }) processedEventIds: string[];
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ gatewayOrderId: 1 }, { unique: true });
PaymentSchema.index({ gatewayPaymentId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ appointmentId: 1 });
PaymentSchema.index({ status: 1, createdAt: 1 });
