import { PutScheduleRequestSchema, type Schedule } from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicAccessService, type ClinicDoctorScope } from '../clinics/clinic-access.service';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { DoctorsService } from '../doctors/doctors.service';
import { ScheduleDocument, ScheduleEntity } from './schedule.schema';
import type { ScheduleInput } from './slots';

const EMPTY = {
  weekly: [],
  exceptions: [],
  bookingWindowDays: 7,
  walkInShare: 0.3,
  isActive: true,
};

/** BE-14 weekly schedules and exceptions, one per doctor and clinic. */
@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(ScheduleEntity.name) private readonly schedules: Model<ScheduleEntity>,
    private readonly access: ClinicAccessService,
    private readonly doctors: DoctorsService,
  ) {}

  /** The caller's scope: their own doctor profile unless `doctorId` names another doctor of the clinic. */
  async scope(userId: string, clinicId: string, doctorId?: string): Promise<ClinicDoctorScope> {
    let id = doctorId;
    if (!id) {
      const own = await this.doctors.findByUserId(userId);
      if (!own) {
        throw AppException.notFound('Pass doctorId: you do not have a doctor profile');
      }
      id = own._id.toHexString();
    }
    return this.access.require(userId, clinicId, id);
  }

  async get(userId: string, clinicId: string, doctorId?: string): Promise<Schedule> {
    const { clinic, doctor } = await this.scope(userId, clinicId, doctorId);
    const s = await this.schedules.findOne({ doctorId: doctor._id, clinicId: clinic._id }).exec();
    return toSchedule(doctor._id, clinic._id, s);
  }

  async put(
    userId: string,
    clinicId: string,
    doctorId: string | undefined,
    body: unknown,
  ): Promise<Schedule> {
    // Cross-field rules (overlaps, end after start, one exception per date) and defaults.
    const parsed = zodCheck(PutScheduleRequestSchema, body);
    const { clinic, doctor } = await this.scope(userId, clinicId, doctorId);
    const saved = await this.schedules
      .findOneAndUpdate(
        { doctorId: doctor._id, clinicId: clinic._id },
        { $set: { ...parsed, updatedBy: new Types.ObjectId(userId) } },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();
    return toSchedule(doctor._id, clinic._id, saved);
  }

  /** Raw schedule for slot and ETA computations; `null` when none is saved. */
  async forDoctorAtClinic(
    doctorId: Types.ObjectId,
    clinicId: Types.ObjectId,
  ): Promise<ScheduleInput | null> {
    const s = await this.schedules.findOne({ doctorId, clinicId }).lean().exec();
    return s ? { weekly: s.weekly, exceptions: s.exceptions, isActive: s.isActive } : null;
  }
}

function toSchedule(
  doctorId: Types.ObjectId,
  clinicId: Types.ObjectId,
  s: ScheduleDocument | null,
): Schedule {
  const src = s ?? EMPTY;
  return {
    doctorId: doctorId.toHexString(),
    clinicId: clinicId.toHexString(),
    weekly: src.weekly.map((b) => ({
      day: b.day,
      start: b.start,
      end: b.end,
      slotMinutes: b.slotMinutes,
      capacityPerSlot: 1,
    })),
    exceptions: src.exceptions.map((e) =>
      e.type === 'leave'
        ? { date: e.date, type: 'leave' as const }
        : {
            date: e.date,
            type: 'custom' as const,
            blocks: (e.blocks ?? []).map((b) => ({
              start: b.start,
              end: b.end,
              slotMinutes: b.slotMinutes,
            })),
          },
    ),
    bookingWindowDays: src.bookingWindowDays,
    walkInShare: src.walkInShare,
    isActive: src.isActive,
    updatedAt: s ? s.updatedAt.toISOString() : null,
  };
}
