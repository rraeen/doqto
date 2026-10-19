import {
  CLINIC_PHOTOS_MAX,
  type ClinicPrivate,
  type CreateClinicRequest,
  type UpdateClinicRequest,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { storeOrReject, type UploadedBlob } from '../common/http/upload';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { toClinicView } from '../doctors/doctor.mappers';
import { DoctorsService } from '../doctors/doctors.service';
import { STORAGE_PROVIDER, toGeoJsonPoint, type StorageProvider } from '../integrations';
import { User } from '../users/user.schema';
import { type ClinicAccess, resolveClinicAccess } from './clinic-scope.guard';
import { Clinic, ClinicDocument } from './clinic.schema';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Clinics and their staff (BE-08). Access is checked by ClinicScopeGuard before these run. */
@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly doctorsService: DoctorsService,
    private readonly config: AppConfig,
  ) {}

  async toPrivate(c: ClinicDocument, access: ClinicAccess): Promise<ClinicPrivate> {
    // Read-only staff do not get their co-workers' phones (DPDP minimisation, RD BE-05 should-fix 3).
    const staff =
      access === 'manage'
        ? await this.users.find({ _id: { $in: c.staffUserIds } }, { name: 1, phone: 1 }).exec()
        : [];
    const addedAt = new Map(c.staffLog.map((s) => [s.userId.toHexString(), s.addedAt] as const));
    return {
      ...toClinicView(c),
      ownerUserId: c.ownerUserId.toHexString(),
      doctorIds: c.doctorIds.map((d) => d.toHexString()),
      staff: staff.map((u) => ({
        userId: u._id.toHexString(),
        name: u.name ?? null,
        phone: u.phone,
        addedAt: addedAt.get(u._id.toHexString())?.toISOString() ?? null,
      })),
      canManage: access === 'manage',
      createdAt: c.createdAt.toISOString(),
    };
  }

  async create(userId: string, body: CreateClinicRequest): Promise<ClinicPrivate> {
    const doctor = await this.doctorsService.requireOwn(userId);
    const clinic = await this.clinics.create({
      name: body.name,
      phone: body.phone,
      address: body.address,
      location: body.location ? toGeoJsonPoint(body.location) : undefined,
      ownerUserId: new Types.ObjectId(userId),
      doctorIds: [doctor._id],
      isDemo: this.config.isDemo,
    });
    // Keep doctors.clinicIds and clinics.doctorIds in sync: link with one atomic write, and undo
    // the clinic if that fails, so a retry never leaves a half-linked duplicate (RD BE-08).
    try {
      await this.doctors
        .updateOne({ _id: doctor._id }, { $addToSet: { clinicIds: clinic._id } })
        .exec();
    } catch (e) {
      await this.clinics.deleteOne({ _id: clinic._id }).exec();
      throw e;
    }
    try {
      await this.doctorsService.refreshListingById(doctor._id);
    } catch (e) {
      // Linked both ways already; city, slug and listing are recomputed on the next write.
      this.logger.warn(`Listing refresh after clinic create failed: ${(e as Error).name}`);
    }
    return this.toPrivate(clinic, 'manage');
  }

  async mine(userId: string): Promise<{ items: ClinicPrivate[] }> {
    const uid = new Types.ObjectId(userId);
    const doctor = await this.doctors.findOne({ userId: uid }, { _id: 1 }).exec();
    const or: Record<string, unknown>[] = [{ ownerUserId: uid }, { staffUserIds: uid }];
    if (doctor) or.push({ doctorIds: doctor._id });
    const found = await this.clinics.find({ $or: or }).sort({ createdAt: 1 }).exec();
    const items: ClinicPrivate[] = [];
    for (const c of found) {
      const access = await resolveClinicAccess(c, userId, this.doctors);
      if (access) items.push(await this.toPrivate(c, access));
    }
    return { items };
  }

  assertManage(access: ClinicAccess | undefined): void {
    if (access !== 'manage')
      throw AppException.forbidden('Only the clinic owner or its doctors can change this');
  }

  async update(c: ClinicDocument, patch: UpdateClinicRequest): Promise<ClinicPrivate> {
    if (Object.keys(patch).length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Provide at least one field',
      );
    }
    if (patch.name !== undefined) c.name = patch.name;
    if (patch.phone !== undefined) c.phone = patch.phone ?? undefined;
    if (patch.address !== undefined) c.set('address', patch.address);
    if (patch.location !== undefined)
      c.set('location', patch.location ? toGeoJsonPoint(patch.location) : undefined);
    await c.save();
    if (patch.address !== undefined) {
      // City is denormalised onto doctors whose primary clinic this is.
      for (const id of c.doctorIds) await this.doctorsService.refreshListingById(id);
    }
    return this.toPrivate(c, 'manage');
  }

  async addPhoto(c: ClinicDocument, file: UploadedBlob): Promise<ClinicPrivate> {
    if (c.photos.length >= CLINIC_PHOTOS_MAX) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        `A clinic can have at most ${CLINIC_PHOTOS_MAX} photos`,
      );
    }
    const stored = await storeOrReject(() =>
      this.storage.putPublic({
        key: `clinics/${c._id.toHexString()}/photo-${Date.now()}.${EXT[file.mimetype] ?? 'bin'}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    c.photos.push({ key: stored.key, url: stored.url });
    await c.save();
    return this.toPrivate(c, 'manage');
  }

  async removePhoto(c: ClinicDocument, index: number): Promise<ClinicPrivate> {
    if (!Number.isInteger(index) || index < 0 || index >= c.photos.length)
      throw AppException.notFound('Photo not found');
    c.photos.splice(index, 1);
    await c.save();
    return this.toPrivate(c, 'manage');
  }

  /** Adds a phone as staff: creates the user if new, grants `clinic_staff`, links both sides. */
  async addStaff(
    c: ClinicDocument,
    actorUserId: string,
    body: { phone: string; name?: string },
  ): Promise<ClinicPrivate> {
    // New accounts get `patient` too and no phoneVerifiedAt, so their first login runs the normal
    // first-login setup (consent, isNewUser). Existing users only gain `clinic_staff`.
    await this.users
      .updateOne(
        { phone: body.phone },
        {
          $setOnInsert: {
            phone: body.phone,
            name: body.name,
            roles: ['patient', 'clinic_staff'],
            whatsappOptIn: false,
            status: 'active',
            isDemo: this.config.isDemo,
          },
        },
        { upsert: true },
      )
      .exec();
    const user = await this.users
      .findOneAndUpdate(
        { phone: body.phone },
        { $addToSet: { roles: 'clinic_staff', clinicIds: c._id } },
        { new: true },
      )
      .exec();
    if (!user) throw new Error('staff upsert returned no user');
    if (c.staffUserIds.some((s) => s.equals(user._id))) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This person is already staff at this clinic',
      );
    }
    const res = await this.clinics
      .findOneAndUpdate(
        { _id: c._id, staffUserIds: { $ne: user._id } },
        {
          $addToSet: { staffUserIds: user._id },
          $push: {
            staffLog: {
              userId: user._id,
              addedAt: new Date(),
              addedBy: new Types.ObjectId(actorUserId),
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!res)
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This person is already staff at this clinic',
      );
    return this.toPrivate(res, 'manage');
  }

  async removeStaff(c: ClinicDocument, staffUserId: string): Promise<ClinicPrivate> {
    if (
      !Types.ObjectId.isValid(staffUserId) ||
      !c.staffUserIds.some((s) => s.toHexString() === staffUserId)
    ) {
      throw AppException.notFound('Staff member not found');
    }
    const uid = new Types.ObjectId(staffUserId);
    const res = await this.clinics
      .findByIdAndUpdate(
        c._id,
        { $pull: { staffUserIds: uid, staffLog: { userId: uid } } },
        { new: true },
      )
      .exec();
    await this.users.updateOne({ _id: uid }, { $pull: { clinicIds: c._id } }).exec();
    // One conditional write, so a concurrent add at another clinic is never undone.
    await this.users
      .updateOne({ _id: uid, clinicIds: { $size: 0 } }, { $pull: { roles: 'clinic_staff' } })
      .exec();
    return this.toPrivate(res!, 'manage');
  }
}
