import {
  DEFAULT_CONSULT_MINUTES,
  type DoctorState,
  type DoctorStatus,
  type UpdateStatusRequest,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment } from '../appointments/appointment.schema';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { firstStart, type ScheduleInput } from '../schedules/slots';
import { DoctorStatusDocument, DoctorStatusEntity } from './doctor-status.schema';
import { StatusEvent } from './status-event.schema';

/** TDD 6.3 EWMA: weight 0.2 on the newest consult; durations outside 1 to 45 minutes are ignored. */
export const EWMA_WEIGHT = 0.2;
export const CONSULT_MINUTES_MIN = 1;
export const CONSULT_MINUTES_MAX = 45;
const QUEUE_LOCK_MS = 10_000;

export function nextAverage(avg: number, minutes: number): number {
  if (minutes < CONSULT_MINUTES_MIN || minutes > CONSULT_MINUTES_MAX) return avg;
  return Math.round(((1 - EWMA_WEIGHT) * avg + EWMA_WEIGHT * minutes) * 100) / 100;
}

type Oid = Types.ObjectId;

/** The polled `doctorStatus` document (DB doc 3.6): one per doctor per IST day. */
@Injectable()
export class DoctorStatusService {
  constructor(
    @InjectModel(DoctorStatusEntity.name) private readonly statuses: Model<DoctorStatusEntity>,
    @InjectModel(StatusEvent.name) private readonly events: Model<StatusEvent>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
  ) {}

  find(doctorId: Oid, date: string): Promise<DoctorStatusDocument | null> {
    return this.statuses.findOne({ doctorId, date }).exec();
  }

  /** Today's document, created on first use with the average carried over from the last day. */
  async ensure(doctorId: Oid, clinicId: Oid, date: string): Promise<DoctorStatusDocument> {
    const existing = await this.find(doctorId, date);
    if (existing) return existing;
    const last = await this.statuses
      .findOne({ doctorId, date: { $lt: date } }, { avgConsultMinutes: 1 })
      .sort({ date: -1 })
      .exec();
    try {
      return (await this.statuses
        .findOneAndUpdate(
          { doctorId, date },
          {
            $setOnInsert: {
              clinicId,
              avgConsultMinutes: last?.avgConsultMinutes ?? DEFAULT_CONSULT_MINUTES,
            },
          },
          { upsert: true, new: true },
        )
        .exec())!;
    } catch (e) {
      // Two first uses racing on the unique { doctorId, date } index: the row exists now.
      if ((e as { code?: number }).code === 11000) return (await this.find(doctorId, date))!;
      throw e;
    }
  }

  /** Next queue token for the day: atomic `$inc`, so parallel check-ins never share one. */
  async nextToken(doctorId: Oid, clinicId: Oid, date: string): Promise<number> {
    await this.ensure(doctorId, clinicId, date);
    const s = await this.statuses
      .findOneAndUpdate({ doctorId, date }, { $inc: { tokenCounter: 1 } }, { new: true })
      .exec();
    return s!.tokenCounter;
  }

  /**
   * Runs a queue change under a short per-doctor lock, so two taps (next, no-show, move) never
   * interleave. The lock expires on its own if the process dies.
   */
  async withQueueLock<T>(
    doctorId: Oid,
    clinicId: Oid,
    date: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.ensure(doctorId, clinicId, date);
    const now = new Date();
    const locked = await this.statuses
      .findOneAndUpdate(
        {
          doctorId,
          date,
          $or: [{ queueLockUntil: { $exists: false } }, { queueLockUntil: { $lt: now } }],
        },
        { $set: { queueLockUntil: new Date(now.getTime() + QUEUE_LOCK_MS) } },
      )
      .exec();
    if (!locked) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'The queue is being updated. Try again.',
      );
    }
    try {
      return await fn();
    } finally {
      await this.statuses.updateOne({ doctorId, date }, { $unset: { queueLockUntil: 1 } }).exec();
    }
  }

  /** Recomputes the denormalised `currentToken` and `queueLength` from the appointments. */
  async recount(doctorId: Oid, clinicId: Oid, date: string): Promise<DoctorStatusDocument> {
    const [current, waiting] = await Promise.all([
      this.appointments
        .findOne({ doctorId, clinicId, date, status: 'in_consult' }, { queueToken: 1 })
        .exec(),
      this.appointments.countDocuments({ doctorId, clinicId, date, status: 'checked_in' }).exec(),
    ]);
    await this.ensure(doctorId, clinicId, date);
    const set: Record<string, unknown> = { queueLength: waiting, clinicId };
    if (current?.queueToken) set.currentToken = current.queueToken;
    return (await this.statuses
      .findOneAndUpdate({ doctorId, date }, { $set: set }, { new: true })
      .exec())!;
  }

  async recordConsult(doctorId: Oid, date: string, minutes: number): Promise<void> {
    const s = await this.find(doctorId, date);
    if (!s) return;
    const avg = nextAverage(s.avgConsultMinutes, minutes);
    if (avg !== s.avgConsultMinutes) {
      await this.statuses.updateOne({ _id: s._id }, { $set: { avgConsultMinutes: avg } }).exec();
    }
  }

  /** BE-18 `PUT /clinic/status`: set the state and append a `statusEvents` row. */
  async update(
    actorUserId: string,
    doctorId: Oid,
    clinicId: Oid,
    body: UpdateStatusRequest,
    schedule: ScheduleInput | null,
    now = new Date(),
  ): Promise<DoctorStatus> {
    const date = istDate(now);
    const before = await this.ensure(doctorId, clinicId, date);
    const delay = body.state === 'running_late' ? (body.delayMinutes ?? 0) : 0;
    let etaAt: Date | null = body.etaAt ? new Date(body.etaAt) : null;
    if (!etaAt && body.state === 'running_late') {
      // Late against the first scheduled start (or now, when there is no schedule or it has passed).
      const start = schedule ? firstStart(schedule, date) : null;
      const base = start && start.getTime() > now.getTime() ? start : now;
      etaAt = new Date(base.getTime() + delay * 60_000);
    }
    const set: Record<string, unknown> = {
      clinicId,
      state: body.state,
      delayMinutes: delay,
      updatedBy: new Types.ObjectId(actorUserId),
      statusSetAt: now,
    };
    const unset: Record<string, 1> = {};
    if (etaAt) set.etaAt = etaAt;
    else unset.etaAt = 1;
    if (body.message !== undefined) {
      if (body.message) set.message = body.message;
      else unset.message = 1;
    }
    const after = (await this.statuses
      .findOneAndUpdate(
        { _id: before._id },
        { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true },
      )
      .exec())!;
    await this.events.create({
      doctorId,
      clinicId,
      date,
      from: before.state,
      to: body.state,
      delayMinutes: delay,
      by: new Types.ObjectId(actorUserId),
      at: now,
    });
    return toDoctorStatus(after, doctorId, date);
  }

  /** Job use (BE-20): set a state without an actor. */
  async setStateBySystem(
    s: DoctorStatusDocument,
    to: DoctorState,
    now = new Date(),
  ): Promise<void> {
    if (s.state === to) return;
    await this.statuses
      .updateOne(
        { _id: s._id },
        { $set: { state: to, delayMinutes: 0, queueLength: 0 }, $unset: { etaAt: 1 } },
      )
      .exec();
    if (s.clinicId) {
      await this.events.create({
        doctorId: s.doctorId,
        clinicId: s.clinicId,
        date: s.date,
        from: s.state,
        to,
        at: now,
      });
    }
  }
}

/** Public, patient-free view. Without a document the doctor is `not_started` with `updatedAt: null`. */
export function toDoctorStatus(
  s: DoctorStatusDocument | null,
  doctorId: Oid,
  date: string,
): DoctorStatus {
  return {
    doctorId: doctorId.toHexString(),
    clinicId: s?.clinicId?.toHexString() ?? null,
    date,
    state: s?.state ?? 'not_started',
    delayMinutes: s?.delayMinutes ?? 0,
    etaAt: s?.etaAt?.toISOString() ?? null,
    message: s?.message ?? null,
    currentToken: s?.currentToken ?? null,
    queueLength: s?.queueLength ?? 0,
    updatedAt: s ? s.updatedAt.toISOString() : null,
  };
}
