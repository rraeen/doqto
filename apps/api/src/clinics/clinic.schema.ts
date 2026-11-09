import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class ClinicAddress {
  @Prop({ required: true }) line1: string;
  @Prop() area?: string;
  @Prop({ required: true }) city: string;
  @Prop() district?: string;
  @Prop({ required: true }) state: string;
  @Prop({ required: true }) pincode: string;
}
const ClinicAddressSchema = SchemaFactory.createForClass(ClinicAddress);

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], required: true }) type: 'Point';
  /** `[lng, lat]` (GeoJSON order, for the 2dsphere index). */
  @Prop({ type: [Number], required: true }) coordinates: [number, number];
}
const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: false })
export class ClinicPhoto {
  /** Public R2 key (DB doc: photos are R2 keys). */
  @Prop({ required: true }) key: string;
  /** Public URL returned by StorageProvider.putPublic, kept so reads need no provider call. */
  @Prop({ required: true }) url: string;
}
const ClinicPhotoSchema = SchemaFactory.createForClass(ClinicPhoto);

@Schema({ _id: false })
export class StaffEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) addedAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) addedBy?: Types.ObjectId;
}
const StaffEntrySchema = SchemaFactory.createForClass(StaffEntry);

/** DB doc 3.3 `clinics`. */
@Schema({ collection: 'clinics', timestamps: true, strict: true })
export class Clinic {
  @Prop({ required: true, trim: true }) name: string;
  @Prop() phone?: string;
  @Prop({ type: ClinicAddressSchema, required: true }) address: ClinicAddress;
  @Prop({ type: GeoPointSchema }) location?: GeoPoint;
  @Prop({ type: [ClinicPhotoSchema], default: [] }) photos: ClinicPhoto[];
  /** The patient-side owner of a clinic made through the old flow. Absent for one from an approved application. */
  @Prop({ type: Types.ObjectId, ref: 'User' }) ownerUserId?: Types.ObjectId;
  /** The provider account that applied, and the application (unit) this clinic comes from. */
  @Prop({ type: Types.ObjectId, ref: 'Account' }) ownerAccountId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Unit' }) unitId?: Types.ObjectId;
  /** Access-control source of truth for clinic_staff. */
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] }) staffUserIds: Types.ObjectId[];
  /** When/by whom each staff member was added (display only; staffUserIds decides access). */
  @Prop({ type: [StaffEntrySchema], default: [] }) staffLog: StaffEntry[];
  @Prop({ type: [Types.ObjectId], ref: 'Doctor', default: [] }) doctorIds: Types.ObjectId[];
  @Prop({ default: 'Asia/Kolkata' }) timezone: string;
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type ClinicDocument = HydratedDocument<Clinic>;
export const ClinicSchema = SchemaFactory.createForClass(Clinic);
ClinicSchema.index({ location: '2dsphere' });
ClinicSchema.index({ 'address.city': 1 });
ClinicSchema.index({ staffUserIds: 1 });
ClinicSchema.index({ unitId: 1 }, { unique: true, partialFilterExpression: { unitId: { $exists: true } } });
