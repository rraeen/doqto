import { PutScheduleRequestSchema, type Schedule } from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { Clinic } from '../clinics/clinic.schema';
import { Doctor } from '../doctors/doctor.schema';
import { ScheduleEntity } from '../schedules/schedule.schema';
import { toSchedule } from '../schedules/schedules.service';
import { requirePermission, WorkspacesService } from './workspaces.service';

/**
 * The weekly hours of an approved clinic or doctor, set from the console. Patients can book only
 * inside these hours (slots are computed from them), so a newly listed doctor has none until this
 * is saved. It works on the doctor and clinic records published from the application.
 */
@Injectable()
export class UnitScheduleService {
  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(ScheduleEntity.name) private readonly schedules: Model<ScheduleEntity>,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** Only the member of an approved clinic or doctor service, who has been published. */
  private async scope(accountId: string, unitId: string) {
    const unit = await this.workspaces.open(accountId, unitId);
    if (unit.kind !== 'clinic') throw AppException.notFound('This service has no schedule');
    requirePermission(unit, 'schedule');
    if (unit.status !== 'verified') {
      throw AppException.forbidden('The schedule opens once Doqto approves your application');
    }
    const uid = new Types.ObjectId(unitId);
    const [doctor, clinic] = await Promise.all([
      this.doctors.findOne({ unitId: uid }).exec(),
      this.clinics.findOne({ unitId: uid }).exec(),
    ]);
    if (!doctor || !clinic) throw AppException.notFound('Your listing is not ready yet');
    return { doctor, clinic };
  }

  async get(accountId: string, unitId: string): Promise<Schedule> {
    const { doctor, clinic } = await this.scope(accountId, unitId);
    const s = await this.schedules.findOne({ doctorId: doctor._id, clinicId: clinic._id }).exec();
    return toSchedule(doctor._id, clinic._id, s);
  }

  /** Replaces the whole schedule (same rules as the doctor schedule API: no overlaps, valid times). */
  async put(accountId: string, unitId: string, body: unknown): Promise<Schedule> {
    const parsed = zodCheck(PutScheduleRequestSchema, body);
    const { doctor, clinic } = await this.scope(accountId, unitId);
    const saved = await this.schedules
      .findOneAndUpdate(
        { doctorId: doctor._id, clinicId: clinic._id },
        { $set: { ...parsed, updatedBy: new Types.ObjectId(accountId) } },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();
    return toSchedule(doctor._id, clinic._id, saved);
  }
}
