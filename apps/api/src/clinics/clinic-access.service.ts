import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { Doctor, DoctorDocument } from '../doctors/doctor.schema';
import { Clinic, ClinicDocument } from './clinic.schema';
import { resolveClinicAccess, type ClinicAccess } from './clinic-scope.guard';

export interface ClinicDoctorScope {
  clinic: ClinicDocument;
  access: ClinicAccess;
  doctor: DoctorDocument;
}

/**
 * Clinic console scoping (BE-14 to BE-18) for routes that carry `clinicId` and `doctorId` in
 * the body or query rather than the path. Same rules as `ClinicScopeGuard`, plus: the doctor
 * must work at that clinic.
 */
@Injectable()
export class ClinicAccessService {
  constructor(
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
  ) {}

  async requireClinic(
    userId: string,
    clinicId: string | Types.ObjectId,
  ): Promise<{ clinic: ClinicDocument; access: ClinicAccess }> {
    if (!isValidObjectId(clinicId)) throw AppException.notFound('Clinic not found');
    const clinic = await this.clinics.findById(clinicId).exec();
    if (!clinic) throw AppException.notFound('Clinic not found');
    const access = await resolveClinicAccess(clinic, userId, this.doctors);
    if (!access) throw AppException.forbidden('You do not have access to this clinic');
    return { clinic, access };
  }

  async require(
    userId: string,
    clinicId: string | Types.ObjectId,
    doctorId: string | Types.ObjectId,
  ): Promise<ClinicDoctorScope> {
    const { clinic, access } = await this.requireClinic(userId, clinicId);
    const did = new Types.ObjectId(String(doctorId));
    if (!clinic.doctorIds.some((d) => d.equals(did))) {
      throw AppException.notFound('This doctor does not work at this clinic');
    }
    const doctor = await this.doctors.findById(did).exec();
    if (!doctor) throw AppException.notFound('Doctor not found');
    return { clinic, access, doctor };
  }
}
