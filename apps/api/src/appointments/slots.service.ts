import { ACTIVE_APPOINTMENT_STATUSES, type SlotsResponse, SlotsQuerySchema } from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { addDays, istDate } from '../common/time/ist';
import { Doctor } from '../doctors/doctor.schema';
import { SchedulesService } from '../schedules/schedules.service';
import { blocksFor, expandSlots, onlineSlots, type Slot } from '../schedules/slots';
import { Appointment } from './appointment.schema';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_WALK_IN_SHARE = 0.3;

const invalid = (path: string, message: string) =>
  new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', message, {
    issues: [{ path, message }],
  });

export interface BookableDoctor {
  _id: Types.ObjectId;
  bookingFee: number;
}

/**
 * TDD 6.1 step 1: the free slots of one doctor at one clinic on one day, computed on read from the
 * schedule minus what is held or booked. Also the single check that a slot may be booked online,
 * used by booking and rescheduling so both apply the same rules.
 */
@Injectable()
export class SlotsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    private readonly schedules: SchedulesService,
  ) {}

  /** A listed doctor who works at `clinicId`; anything else is a 404 (never reveals why). */
  async bookableDoctor(doctorId: string, clinicId: string): Promise<BookableDoctor> {
    const d = isValidObjectId(doctorId)
      ? await this.doctors
          .findOne({ _id: doctorId, isListed: true }, { clinicIds: 1, bookingFee: 1 })
          .lean()
          .exec()
      : null;
    if (!d || !d.clinicIds.some((c) => c.toHexString() === clinicId)) {
      throw AppException.notFound('Doctor not found');
    }
    return { _id: d._id, bookingFee: d.bookingFee ?? 0 };
  }

  /** Slots offered online on `date` (free ones only), earliest first. */
  async forDay(doctorId: string, rawQuery: unknown, now = new Date()): Promise<SlotsResponse> {
    const query = zodCheck(SlotsQuerySchema, rawQuery);
    const doctor = await this.bookableDoctor(doctorId, query.clinicId);
    const base = { date: query.date, clinicId: query.clinicId, bookingFee: doctor.bookingFee };
    const schedule = await this.schedules.forDoctorAtClinic(
      doctor._id,
      new Types.ObjectId(query.clinicId),
    );
    const today = istDate(now);
    const window = schedule?.bookingWindowDays ?? DEFAULT_WINDOW_DAYS;
    if (
      !schedule ||
      query.date < today ||
      query.date > addDays(today, window) ||
      blocksFor(schedule, query.date).length === 0
    ) {
      return { ...base, slots: [], scheduled: false };
    }
    const offered = onlineSlots(
      expandSlots(schedule, query.date),
      schedule.walkInShare ?? DEFAULT_WALK_IN_SHARE,
    ).filter((s) => s.start.getTime() > now.getTime());
    const taken = new Set(
      (
        await this.appointments
          .find(
            {
              doctorId: doctor._id,
              date: query.date,
              status: { $in: [...ACTIVE_APPOINTMENT_STATUSES] },
              slotStart: { $exists: true },
              // A hold that ran out frees its slot at once, before the minute job marks it.
              $nor: [{ status: 'pending_payment', holdExpiresAt: { $lte: now } }],
            },
            { slotStart: 1 },
          )
          .lean()
          .exec()
      ).map((a) => a.slotStart?.getTime()),
    );
    return {
      ...base,
      scheduled: true,
      slots: offered
        .filter((s) => !taken.has(s.start.getTime()))
        .map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    };
  }

  /**
   * The slot a patient asks for, if it is one the doctor offers online right now. Throws a 400
   * for a time that is not on the schedule, outside the booking window, in the past, or held back
   * for walk-ins. Whether it is still free is decided by the unique index when it is saved.
   */
  async resolveOnlineSlot(
    doctorId: Types.ObjectId,
    clinicId: Types.ObjectId,
    slotStart: string,
    now = new Date(),
  ): Promise<Slot & { date: string }> {
    const start = new Date(slotStart);
    const date = istDate(start);
    const schedule = await this.schedules.forDoctorAtClinic(doctorId, clinicId);
    const today = istDate(now);
    const window = schedule?.bookingWindowDays ?? DEFAULT_WINDOW_DAYS;
    if (!schedule || date < today || date > addDays(today, window)) {
      throw invalid('slotStart', 'That day is not open for booking');
    }
    if (start.getTime() <= now.getTime()) throw invalid('slotStart', 'That time has passed');
    const slot = onlineSlots(
      expandSlots(schedule, date),
      schedule.walkInShare ?? DEFAULT_WALK_IN_SHARE,
    ).find((s) => s.start.getTime() === start.getTime());
    if (!slot) throw invalid('slotStart', 'That time is not available for online booking');
    return { ...slot, date };
  }
}
