import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, STATUS_HISTORY_MAX } from '../appointments/appointment.schema';
import { IstDateSchema } from '@doqto/shared';
import { istDayRange } from '../common/time/ist';
import { DoctorStatusEntity } from '../status/doctor-status.schema';
import { DoctorStatusService } from '../status/doctor-status.service';
import { JobsService } from './jobs.service';

export const END_OF_DAY_JOB = 'end-of-day';
/** Reviews unlock 24 hours after the clinic day ends when nobody pressed "complete" (DB doc 3.5). */
const REVIEW_UNLOCK_AFTER_DAY_MS = 24 * 3600_000;

export const endOfDayKey = (date: string) => `${END_OF_DAY_JOB}:${date}`;

const push = (status: string, at: Date, note: string) => ({
  $push: { statusHistory: { $each: [{ status, at, note }], $slice: -STATUS_HISTORY_MAX } },
});

export interface EndOfDayResult {
  noShows: number;
  completed: number;
  statusesClosed: number;
}

/**
 * BE-20: closes an IST day. Bookings nobody checked in become `no_show`; verified visits still
 * open (checked in or in consult) become `completed` so a clinic cannot block a review by never
 * pressing "complete" (TDD 5.2 rule 4); every doctor status of the day becomes `done_for_day`
 * unless the doctor was on leave. Idempotent: a rerun finds nothing left to change.
 */
@Injectable()
export class EndOfDayService implements OnModuleInit {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(DoctorStatusEntity.name) private readonly statuses: Model<DoctorStatusEntity>,
    private readonly status: DoctorStatusService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(END_OF_DAY_JOB, (payload) =>
      this.run(IstDateSchema.parse(payload.date)).then(() => undefined),
    );
  }

  async run(date: string, now = new Date()): Promise<EndOfDayResult> {
    const dayEnd = istDayRange(date).end;
    const noShows = await this.appointments
      .updateMany(
        { date, status: 'confirmed' },
        { $set: { status: 'no_show' }, ...push('no_show', now, 'end of day') },
      )
      .exec();
    const reviewUnlockAt = new Date(dayEnd.getTime() + REVIEW_UNLOCK_AFTER_DAY_MS);
    const inConsult = await this.appointments
      .updateMany(
        { date, status: 'in_consult' },
        {
          $set: { status: 'completed', consultEndAt: now, reviewUnlockAt },
          ...push('completed', now, 'end of day'),
        },
      )
      .exec();
    const checkedIn = await this.appointments
      .updateMany(
        { date, status: 'checked_in' },
        {
          $set: { status: 'completed', reviewUnlockAt },
          ...push('completed', now, 'end of day'),
        },
      )
      .exec();
    let statusesClosed = 0;
    const open = await this.statuses
      .find({ date, state: { $nin: ['on_leave', 'done_for_day'] } })
      .exec();
    for (const s of open) {
      await this.status.setStateBySystem(s, 'done_for_day', now);
      statusesClosed++;
    }
    return {
      noShows: noShows.modifiedCount,
      completed: inConsult.modifiedCount + checkedIn.modifiedCount,
      statusesClosed,
    };
  }
}
