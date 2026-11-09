import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { AuthedRequest } from '../auth/auth.types';
import { AppException } from '../common/http/app-exception';
import { Doctor } from '../doctors/doctor.schema';
import { Clinic, ClinicDocument } from './clinic.schema';

export type ClinicAccess = 'manage' | 'staff';

export interface ClinicScopedRequest extends AuthedRequest {
  clinic?: ClinicDocument;
  clinicAccess?: ClinicAccess;
}

/**
 * BE-08 clinic scoping. Resolves `:id` (or `:clinicId`) and lets through only the clinic's
 * owner, its doctors (`manage`) and its staff from `staffUserIds` (`staff`). Admins do not get
 * implicit access. Attaches the clinic and the access level to the request.
 */
@Injectable()
export class ClinicScopeGuard implements CanActivate {
  constructor(
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & ClinicScopedRequest>();
    const user = req.user;
    if (!user) throw AppException.unauthenticated();
    const id = req.params.id ?? req.params.clinicId;
    if (!id || !isValidObjectId(id)) throw AppException.notFound('Clinic not found');
    const clinic = await this.clinics.findById(id).exec();
    if (!clinic) throw AppException.notFound('Clinic not found');

    const access = await resolveClinicAccess(clinic, user.id, this.doctors);
    if (!access) throw AppException.forbidden('You do not have access to this clinic');
    req.clinic = clinic;
    req.clinicAccess = access;
    return true;
  }
}

export async function resolveClinicAccess(
  clinic: ClinicDocument,
  userId: string,
  doctors: Model<Doctor>,
): Promise<ClinicAccess | null> {
  const uid = new Types.ObjectId(userId);
  if (clinic.ownerUserId?.equals(uid)) return 'manage';
  // A clinic from an approved application is owned by the provider account that applied.
  if (clinic.ownerAccountId?.equals(uid)) return 'manage';
  const doctor = await doctors.findOne({ userId: uid }, { _id: 1 }).exec();
  if (doctor && clinic.doctorIds.some((d) => d.equals(doctor._id))) return 'manage';
  if (clinic.staffUserIds.some((s) => s.equals(uid))) return 'staff';
  return null;
}
