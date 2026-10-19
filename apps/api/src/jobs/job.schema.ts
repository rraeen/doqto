import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** DB doc 3.12 `jobs`, claimed with `findOneAndUpdate` (DB doc 5). */
@Schema({ collection: 'jobs', timestamps: true, strict: true })
export class Job {
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) runAt: Date;
  @Prop({ type: Object, default: {} }) payload: Record<string, unknown>;
  @Prop({ type: String, enum: JOB_STATUSES, default: 'queued' }) status: JobStatus;
  @Prop() lockedBy?: string;
  @Prop() lockedUntil?: Date;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ default: 5 }) maxAttempts: number;
  /** Scrubbed message of the last failure. */
  @Prop({ maxlength: 500 }) lastError?: string;
  /** e.g. `end-of-day:2026-10-10`: enqueueing the same key twice is a no-op. */
  @Prop() dedupeKey?: string;
  @Prop() finishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type JobDocument = HydratedDocument<Job>;
export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ status: 1, runAt: 1 });
JobSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
// Finished jobs are history only.
JobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
