import {
  REPORT_REASONS,
  REVIEW_STATES,
  VISIT_REASONS,
  WOULD_RECOMMEND,
  type ReportReason,
  type ReviewState,
  type VisitReason,
  type WouldRecommend,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class ReviewRatingsDoc {
  @Prop({ required: true, min: 1, max: 5 }) waitTime: number;
  @Prop({ required: true, min: 1, max: 5 }) explanation: number;
  @Prop({ required: true, min: 1, max: 5 }) behaviour: number;
  @Prop({ required: true, min: 1, max: 5 }) facilities: number;
  @Prop({ required: true, min: 1, max: 5 }) valueForMoney: number;
}
const ReviewRatingsDocSchema = SchemaFactory.createForClass(ReviewRatingsDoc);

@Schema({ _id: false })
export class FraudInfo {
  @Prop({ required: true }) score: number;
  @Prop({ type: [String], default: [] }) signals: string[];
  @Prop({ required: true }) scoredAt: Date;
}
const FraudInfoSchema = SchemaFactory.createForClass(FraudInfo);

@Schema({ _id: false })
export class ReviewReport {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: String, enum: REPORT_REASONS, required: true }) reason: ReportReason;
  @Prop({ required: true }) at: Date;
}
const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);

@Schema({ _id: false })
export class ReviewReply {
  @Prop({ required: true, maxlength: 1000 }) text: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) by?: Types.ObjectId;
  @Prop({ required: true }) at: Date;
}
const ReviewReplySchema = SchemaFactory.createForClass(ReviewReply);

/** DB doc 3.8 `reviews`: one per verified visit (unique `appointmentId`). */
@Schema({ collection: 'reviews', timestamps: true, strict: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true }) doctorId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Appointment', required: true })
  appointmentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) patientUserId: Types.ObjectId;
  @Prop({ type: ReviewRatingsDocSchema, required: true }) ratings: ReviewRatingsDoc;
  @Prop({ type: String, enum: WOULD_RECOMMEND, required: true }) wouldRecommend: WouldRecommend;
  @Prop({ type: String, enum: VISIT_REASONS, required: true }) visitReason: VisitReason;
  @Prop({ maxlength: 1000 }) text?: string;
  @Prop() waitedMinutesReported?: number;
  @Prop({ type: String, enum: REVIEW_STATES, required: true }) state: ReviewState;
  /** Counts in the doctor's rating summary: published, low fraud score, and the patient's latest. */
  @Prop({ default: false }) countsInSummary: boolean;
  /** A newer review by the same patient for the same doctor replaced this one in the summary. */
  @Prop({ type: Types.ObjectId, ref: 'Review' }) supersededBy?: Types.ObjectId;
  /** The visit month `YYYY-MM`, kept so the public list needs no appointment lookup. */
  @Prop({ required: true }) visitMonth: string;
  @Prop({ required: true }) submittedAt: Date;
  @Prop() publishAt?: Date;
  @Prop() editedAt?: Date;
  @Prop({ default: 0 }) editCount: number;
  @Prop({ type: FraudInfoSchema }) fraud?: FraudInfo;
  @Prop({ type: ReviewReplySchema }) reply?: ReviewReply;
  @Prop({ type: [ReviewReportSchema], default: [] }) reports: ReviewReport[];
  @Prop({ default: false }) isDemo: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ appointmentId: 1 }, { unique: true });
// The public list of a doctor, newest first.
ReviewSchema.index({ doctorId: 1, state: 1, publishAt: -1 });
// Supersede lookup: the same patient's reviews of the same doctor.
ReviewSchema.index({ doctorId: 1, patientUserId: 1, submittedAt: -1 });
ReviewSchema.index({ patientUserId: 1, submittedAt: -1 });
// Admin queue: highest fraud scores first.
ReviewSchema.index({ state: 1, 'fraud.score': -1 });
