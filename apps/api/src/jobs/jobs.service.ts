import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { Model } from 'mongoose';
import { Job, JobDocument } from './job.schema';

/** A claimed job is someone else's to retry once its lease runs out (a crashed or stuck worker). */
export const JOB_LEASE_MS = 5 * 60_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 3600_000;

export type JobHandler = (payload: Record<string, unknown>, job: JobDocument) => Promise<void>;

export interface EnqueueOptions {
  runAt?: Date;
  /** Same key twice is a no-op while the first job is kept (30 days after it finishes). */
  dedupeKey?: string;
  maxAttempts?: number;
}

/** 30 s, 1 min, 2 min ... capped at an hour. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

/** Error text for `lastError`: no phone numbers or digit runs of 4 or more (codes, OTPs), at most 500 chars. */
export function scrubError(e: unknown): string {
  const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return text.replace(/\+?\d[\d\s-]{2,}\d/g, '[redacted]').slice(0, 500);
}

const isDuplicateKey = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 11000;

/**
 * BE-19 Mongo-backed jobs (DB doc 5): claimed with one `findOneAndUpdate`, so two API instances
 * never run the same job at once. Handlers must be idempotent: a job whose worker dies is run
 * again after its lease.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  readonly workerId = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;

  constructor(@InjectModel(Job.name) private readonly jobs: Model<Job>) {}

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) throw new Error(`Job handler for ${type} is already registered`);
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: Record<string, unknown> = {},
    options: EnqueueOptions = {},
  ): Promise<JobDocument> {
    try {
      return await this.jobs.create({
        type,
        payload,
        runAt: options.runAt ?? new Date(),
        ...(options.dedupeKey ? { dedupeKey: options.dedupeKey } : {}),
        ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
      });
    } catch (e) {
      if (!options.dedupeKey || !isDuplicateKey(e)) throw e;
      return (await this.jobs.findOne({ dedupeKey: options.dedupeKey }).exec())!;
    }
  }

  /** Takes the oldest due job (or one whose lease expired) for `workerId`, or `null`. */
  claim(workerId: string = this.workerId, now = new Date()): Promise<JobDocument | null> {
    return this.jobs
      .findOneAndUpdate(
        {
          $or: [
            { status: 'queued', runAt: { $lte: now } },
            { status: 'running', lockedUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            status: 'running',
            lockedBy: workerId,
            lockedUntil: new Date(now.getTime() + JOB_LEASE_MS),
          },
          $inc: { attempts: 1 },
        },
        { sort: { runAt: 1, _id: 1 }, new: true },
      )
      .exec();
  }

  /** Only the worker holding the lease can finish the job. */
  async complete(job: JobDocument, now = new Date()): Promise<boolean> {
    const r = await this.jobs
      .updateOne(
        { _id: job._id, status: 'running', lockedBy: job.lockedBy },
        {
          $set: { status: 'done', finishedAt: now },
          $unset: { lockedBy: 1, lockedUntil: 1, lastError: 1 },
        },
      )
      .exec();
    return r.modifiedCount === 1;
  }

  /** Requeues with backoff, or marks `failed` after `maxAttempts`. */
  async fail(job: JobDocument, error: unknown, now = new Date()): Promise<void> {
    const final = job.attempts >= job.maxAttempts;
    await this.jobs
      .updateOne(
        { _id: job._id, status: 'running', lockedBy: job.lockedBy },
        {
          $set: {
            lastError: scrubError(error),
            ...(final
              ? { status: 'failed', finishedAt: now }
              : { status: 'queued', runAt: new Date(now.getTime() + backoffMs(job.attempts)) }),
          },
          $unset: { lockedBy: 1, lockedUntil: 1 },
        },
      )
      .exec();
  }

  /** Claims and runs one job. Returns `false` when nothing was due. */
  async runOne(workerId: string = this.workerId, now = new Date()): Promise<boolean> {
    const job = await this.claim(workerId, now);
    if (!job) return false;
    const handler = this.handlers.get(job.type);
    try {
      if (!handler) throw new Error(`No handler for job type ${job.type}`);
      await handler(job.payload, job);
      await this.complete(job);
    } catch (e) {
      this.logger.warn(`Job ${job.type} ${job._id.toHexString()} failed (attempt ${job.attempts})`);
      await this.fail(job, e);
    }
    return true;
  }

  /** Runs due jobs until none is left or `max` have run. */
  async drain(max = 50, workerId: string = this.workerId): Promise<number> {
    let n = 0;
    while (n < max && (await this.runOne(workerId))) n++;
    return n;
  }
}
