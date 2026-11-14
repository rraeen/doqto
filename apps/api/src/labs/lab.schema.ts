import {
  LAB_BOOKING_STATUSES,
  LAB_COLLECTION_MODES,
  LAB_WINDOWS,
  type LabBookingStatus,
  type LabCollectionMode,
  type LabWindow,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * The patient-facing listing of an approved lab. It is written from the lab's application when
 * Doqto approves it (`UnitPublishingService`) and taken off the site when the approval is
 * withdrawn. The lab's tests are in `LabTest`.
 */
@Schema({ collection: 'labs', timestamps: true, strict: true })
export class Lab {
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true }) unitId: Types.ObjectId;
  @Prop({ required: true }) name: string;
  /** Unique, from the name and city; never changes once listed. */
  @Prop({ required: true }) slug: string;
  /** Lower-cased, like `Doctor.city`, so a city search matches whatever case the lab typed. */
  @Prop({ required: true }) city: string;
  @Prop({ required: true }) cityLabel: string;
  @Prop({ required: true }) address: string;
  @Prop({ default: false }) nablAccredited: boolean;
  @Prop({ default: false }) homeCollection: boolean;
  @Prop() turnaroundHours?: number;
  @Prop({ default: false }) isListed: boolean;
  @Prop({ default: false }) isDemo: boolean;
}
export type LabDocument = HydratedDocument<Lab>;
export const LabSchema = SchemaFactory.createForClass(Lab);
LabSchema.index({ unitId: 1 }, { unique: true });
LabSchema.index({ slug: 1 }, { unique: true });
LabSchema.index({ isListed: 1, city: 1 });

/** A group of tests ("Blood", "Thyroid"), made by the lab. */
@Schema({ collection: 'labCategories', timestamps: true, strict: true })
export class LabCategory {
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true }) unitId: Types.ObjectId;
  @Prop({ required: true }) name: string;
}
export type LabCategoryDocument = HydratedDocument<LabCategory>;
export const LabCategorySchema = SchemaFactory.createForClass(LabCategory);
LabCategorySchema.index({ unitId: 1, name: 1 }, { unique: true });

/** One test the lab offers, with its price (in paise). */
@Schema({ collection: 'labTests', timestamps: true, strict: true })
export class LabTest {
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true }) unitId: Types.ObjectId;
  @Prop({ required: true }) name: string;
  @Prop({ type: Types.ObjectId, ref: 'LabCategory' }) categoryId?: Types.ObjectId;
  @Prop({ required: true }) pricePaise: number;
  @Prop() sampleType?: string;
  @Prop() preparation?: string;
  @Prop() turnaroundHours?: number;
  @Prop({ default: false }) homeCollection: boolean;
  /** Switched off: hidden from patients, kept for old bookings. */
  @Prop({ default: true }) active: boolean;
}
export type LabTestDocument = HydratedDocument<LabTest>;
export const LabTestSchema = SchemaFactory.createForClass(LabTest);
LabTestSchema.index({ unitId: 1, active: 1 });

class BookingItem {
  @Prop({ type: Types.ObjectId, required: true }) testId: Types.ObjectId;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) pricePaise: number;
}

class LabStatusEntry {
  @Prop({ type: String, enum: LAB_BOOKING_STATUSES, required: true }) status: LabBookingStatus;
  @Prop({ required: true }) at: Date;
}

/**
 * A patient's request for tests. There is no payment: the lab accepts or rejects, and the patient
 * pays at the lab. Names and prices of the tests are copied here, so a later price change does not
 * alter an old booking.
 */
@Schema({ collection: 'labBookings', timestamps: true, strict: true })
export class LabBooking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Lab', required: true }) labId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true }) unitId: Types.ObjectId;
  /** Six characters the patient can read out at the lab. */
  @Prop({ required: true }) code: string;
  @Prop({ required: true }) patientName: string;
  @Prop({ required: true }) patientPhone: string;
  @Prop({ type: [BookingItem], default: [] }) items: BookingItem[];
  @Prop({ required: true }) totalPaise: number;
  @Prop({ type: String, enum: LAB_COLLECTION_MODES, required: true }) mode: LabCollectionMode;
  /** IST day, `YYYY-MM-DD`. */
  @Prop({ required: true }) date: string;
  @Prop({ type: String, enum: LAB_WINDOWS, required: true }) window: LabWindow;
  @Prop() address?: string;
  @Prop() note?: string;
  @Prop({ type: String, enum: LAB_BOOKING_STATUSES, required: true }) status: LabBookingStatus;
  @Prop({ type: [LabStatusEntry], default: [] }) statusHistory: LabStatusEntry[];
  @Prop() rejectReason?: string;
  /** The staff member (or owner) who will collect the sample. */
  @Prop({ type: Types.ObjectId, ref: 'Account' }) assignedToAccountId?: Types.ObjectId;
  @Prop() reportKey?: string;
  @Prop() reportUploadedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Account' }) reportUploadedBy?: Types.ObjectId;
  @Prop({ default: false }) isDemo: boolean;
}
export type LabBookingDocument = HydratedDocument<LabBooking>;
export const LabBookingSchema = SchemaFactory.createForClass(LabBooking);
LabBookingSchema.index({ patientUserId: 1, createdAt: -1 });
LabBookingSchema.index({ unitId: 1, status: 1, date: 1 });
