import {
  BOOKING_FEE_MAX,
  BOOKING_FEE_MIN,
  CONSULT_FEE_MAX,
  GENDERS,
  VERIFICATION_STATUSES,
  type Gender,
  type SpecialtyKey,
  type VerificationStatus,
  SPECIALTY_KEYS,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class QualificationEntry {
  @Prop({ required: true }) degree: string;
  @Prop() institute?: string;
  @Prop() year?: number;
}
const QualificationEntrySchema = SchemaFactory.createForClass(QualificationEntry);

@Schema({ _id: false })
export class RegistrationInfo {
  @Prop({ required: true }) council: string;
  @Prop({ required: true }) number: string;
  @Prop({ required: true }) year: number;
  /** Private R2 object key of the scan (StorageProvider.putPrivate). Never public. */
  @Prop() docKey?: string;
  @Prop() docContentType?: string;
  @Prop() docSizeBytes?: number;
  @Prop() docUploadedAt?: Date;
  /** Superseded scan keys, kept so retention and account deletion (BE-42) can remove them. */
  @Prop({ type: [String], default: undefined }) previousDocKeys?: string[];
}
const RegistrationInfoSchema = SchemaFactory.createForClass(RegistrationInfo);

@Schema({ _id: false })
export class VerificationInfo {
  @Prop({ type: String, enum: VERIFICATION_STATUSES, default: 'pending' })
  status: VerificationStatus;
  @Prop({ type: Types.ObjectId, ref: 'User' }) verifiedBy?: Types.ObjectId;
  @Prop() verifiedAt?: Date;
  @Prop() notes?: string;
  /** When the doctor last (re)submitted for review. The admin queue orders by `createdAt`. */
  @Prop() submittedAt?: Date;
}
const VerificationInfoSchema = SchemaFactory.createForClass(VerificationInfo);

@Schema({ _id: false })
export class RatingSummaryCache {
  @Prop({ required: true }) count: number;
  @Prop({ required: true }) recommendPct: number;
  @Prop({ required: true }) waitTime: number;
  @Prop({ required: true }) explanation: number;
  @Prop({ required: true }) behaviour: number;
  @Prop({ required: true }) facilities: number;
  @Prop({ required: true }) valueForMoney: number;
  @Prop({ required: true }) updatedAt: Date;
}
const RatingSummaryCacheSchema = SchemaFactory.createForClass(RatingSummaryCache);

/** DB doc 3.2 `doctors`. */
// optimisticConcurrency: every save() checks and bumps __v, so an admin decision, a doctor's edit
// and a clinic address change can never silently overwrite each other (RD BE-09 blocker).
@Schema({ collection: 'doctors', timestamps: true, strict: true, optimisticConcurrency: true })
export class Doctor {
  /** The patient-side user of a doctor onboarded through the old flow. Absent for a doctor listed from an approved application. */
  @Prop({ type: Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  /** The provider account that applied, and the application (unit) this listing comes from. */
  @Prop({ type: Types.ObjectId, ref: 'Account' }) accountId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Unit' }) unitId?: Types.ObjectId;
  /** `dr-<name>-<city>`, unique; frozen once the doctor has been listed. */
  @Prop({ required: true }) slug: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ type: String, enum: GENDERS }) gender?: Gender;
  /** Public R2 key of the profile photo, and its public URL from putPublic. */
  @Prop() photoKey?: string;
  @Prop() photoUrl?: string;
  @Prop() bio?: string;
  @Prop({ type: [String], default: [] }) languages: string[];
  @Prop({ type: [QualificationEntrySchema], default: [] }) qualifications: QualificationEntry[];
  @Prop({ type: [String], enum: SPECIALTY_KEYS, default: [] }) specialties: SpecialtyKey[];
  @Prop() experienceYears?: number;
  @Prop({ type: RegistrationInfoSchema, required: true }) registration: RegistrationInfo;
  @Prop({ type: VerificationInfoSchema, default: () => ({ status: 'pending' }) })
  verification: VerificationInfo;
  @Prop({ type: [Types.ObjectId], ref: 'Clinic', default: [] }) clinicIds: Types.ObjectId[];
  /** Paise, informational. */
  @Prop({ min: 0, max: CONSULT_FEE_MAX, validate: Number.isInteger }) consultFee?: number;
  /** Paise, 1000 to 2000. */
  @Prop({ min: BOOKING_FEE_MIN, max: BOOKING_FEE_MAX, validate: Number.isInteger })
  bookingFee?: number;
  /** Cache written only by the rating job (BE-35). */
  @Prop({ type: RatingSummaryCacheSchema }) ratingSummary?: RatingSummaryCache;
  /** Derived: verified and profile complete (see listing.ts). Never set from a request. */
  @Prop({ default: false }) isListed: boolean;
  /** Denormalised from the primary (first) clinic for fast filtering; lower-case for matching. */
  @Prop() city?: string;
  /** Set the first time the doctor is listed; the slug never changes after that. */
  @Prop({ default: false }) slugLocked: boolean;
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type DoctorDocument = HydratedDocument<Doctor>;
export const DoctorSchema = SchemaFactory.createForClass(Doctor);
DoctorSchema.index({ slug: 1 }, { unique: true });
// Unique only where set: doctors listed from an application have no patient-side user.
DoctorSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } });
DoctorSchema.index({ unitId: 1 }, { unique: true, partialFilterExpression: { unitId: { $exists: true } } });
DoctorSchema.index({ isListed: 1, city: 1, specialties: 1 });
DoctorSchema.index({ 'verification.status': 1, createdAt: 1 });
// Admin queue: oldest submission first (migration 0003).
DoctorSchema.index({ 'verification.status': 1, 'verification.submittedAt': 1, _id: 1 });
DoctorSchema.index(
  { name: 'text', specialties: 'text' },
  { name: 'doctor_text', default_language: 'none' },
);
