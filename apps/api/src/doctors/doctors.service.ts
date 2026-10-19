import {
  type DoctorOnboardingRequest,
  type DoctorPrivateProfile,
  type RegistrationDocumentResponse,
  type UpdateDoctorProfileRequest,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { storeOrReject, type UploadedBlob } from '../common/http/upload';
import { AppConfig } from '../config/app-config.service';
import { EXTENSION_BY_TYPE, STORAGE_PROVIDER, type StorageProvider } from '../integrations';
import { User } from '../users/user.schema';
import { Doctor, DoctorDocument } from './doctor.schema';
import { toPrivateProfile } from './doctor.mappers';
import { computeIsListed } from './listing';
import { baseSlug, isSlugConflict, retryOnSlugConflict, uniqueSlug } from './slug';

/** Name as the council register would show it: case, spacing and a leading "Dr" do not matter. */
const comparableName = (name: string) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*dr\.?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Doctor onboarding and self-service profile (BE-07). */
@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly config: AppConfig,
  ) {}

  async findByUserId(userId: string): Promise<DoctorDocument | null> {
    return this.doctors.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async requireOwn(userId: string): Promise<DoctorDocument> {
    const d = await this.findByUserId(userId);
    if (!d) throw AppException.notFound('Complete doctor onboarding first');
    return d;
  }

  async onboard(userId: string, body: DoctorOnboardingRequest): Promise<DoctorPrivateProfile> {
    if (await this.doctors.exists({ userId: new Types.ObjectId(userId) })) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'You have already started onboarding. Edit your profile instead.',
      );
    }
    // Role first: an extra role without a profile grants nothing, while a profile without the
    // role could never get it back (a retry is 409). Idempotent.
    await this.users
      .updateOne({ _id: new Types.ObjectId(userId) }, { $addToSet: { roles: 'doctor' } })
      .exec();
    let doctor: DoctorDocument;
    try {
      doctor = await retryOnSlugConflict(async () =>
        this.doctors.create({
          userId: new Types.ObjectId(userId),
          slug: await uniqueSlug(baseSlug(body.name, ''), (s) => this.slugTaken(s)),
          name: body.name,
          gender: body.gender,
          languages: body.languages ?? [],
          qualifications: body.qualifications,
          specialties: body.specialties,
          experienceYears: body.experienceYears,
          registration: body.registration,
          verification: { status: 'pending', submittedAt: new Date() },
          isDemo: this.config.isDemo,
        }),
      );
    } catch (e) {
      // Only a duplicate `userId` means "already onboarded"; slug races are retried above.
      if ((e as { code?: number }).code === 11000 && !isSlugConflict(e)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'You have already started onboarding. Edit your profile instead.',
        );
      }
      throw e;
    }
    return toPrivateProfile(doctor);
  }

  async getOwn(userId: string): Promise<DoctorPrivateProfile> {
    return toPrivateProfile(await this.requireOwn(userId));
  }

  async updateOwn(
    userId: string,
    patch: UpdateDoctorProfileRequest,
  ): Promise<DoctorPrivateProfile> {
    const d = await this.requireOwn(userId);
    if (Object.keys(patch).length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Provide at least one field',
      );
    }
    // Explicit allowlist: the DTO already rejects anything else; this keeps the write side honest too.
    if (patch.name !== undefined && comparableName(patch.name) !== comparableName(d.name)) {
      // The admin checked the registration against this name: a real rename needs review again,
      // or a verified badge would sit on someone else's name (RD BE-07 should-fix 2).
      d.name = patch.name;
      this.resubmit(d);
    } else if (patch.name !== undefined) {
      d.name = patch.name; // spacing, case or "Dr" only
    }
    if (patch.gender !== undefined) d.gender = patch.gender ?? undefined;
    if (patch.bio !== undefined) d.bio = patch.bio ?? undefined;
    if (patch.languages !== undefined) d.languages = patch.languages;
    if (patch.qualifications !== undefined) d.set('qualifications', patch.qualifications);
    if (patch.specialties !== undefined) d.specialties = patch.specialties;
    if (patch.experienceYears !== undefined) d.experienceYears = patch.experienceYears ?? undefined;
    if (patch.consultFee !== undefined) d.consultFee = patch.consultFee ?? undefined;
    if (patch.bookingFee !== undefined) d.bookingFee = patch.bookingFee ?? undefined;
    if (patch.registration !== undefined) {
      const r = patch.registration;
      const changed =
        r.council !== d.registration.council ||
        r.number !== d.registration.number ||
        r.year !== d.registration.year;
      if (changed) {
        d.registration.council = r.council;
        d.registration.number = r.number;
        d.registration.year = r.year;
        this.resubmit(d);
      }
    }
    return toPrivateProfile(await this.saveWithListing(d));
  }

  async uploadRegistrationDocument(
    userId: string,
    file: UploadedBlob,
  ): Promise<RegistrationDocumentResponse> {
    const d = await this.requireOwn(userId);
    const ext = EXTENSION_BY_TYPE[file.mimetype] ?? 'bin';
    const stored = await storeOrReject(() =>
      this.storage.putPrivate({
        key: `doctors/${d._id.toHexString()}/registration-${Date.now()}.${ext}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    const now = new Date();
    // Keep superseded scans findable for retention and account deletion (BE-42).
    if (d.registration.docKey) {
      d.registration.previousDocKeys = [
        ...(d.registration.previousDocKeys ?? []),
        d.registration.docKey,
      ];
    }
    d.registration.docKey = stored.key;
    d.registration.docContentType = stored.contentType;
    d.registration.docSizeBytes = stored.size;
    d.registration.docUploadedAt = now;
    this.resubmit(d);
    await this.saveWithListing(d);
    return {
      uploadedAt: now.toISOString(),
      contentType: stored.contentType as RegistrationDocumentResponse['contentType'],
      sizeBytes: stored.size,
    };
  }

  async uploadPhoto(userId: string, file: UploadedBlob): Promise<DoctorPrivateProfile> {
    const d = await this.requireOwn(userId);
    const stored = await storeOrReject(() =>
      this.storage.putPublic({
        key: `doctors/${d._id.toHexString()}/photo-${Date.now()}.${EXTENSION_BY_TYPE[file.mimetype] ?? 'bin'}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    d.photoKey = stored.key;
    d.photoUrl = stored.url;
    return toPrivateProfile(await d.save());
  }

  /**
   * Recomputes `city` (from the primary clinic), the slug (until first listed) and `isListed`.
   * Every write that can affect listing goes through here.
   */
  async saveWithListing(d: DoctorDocument): Promise<DoctorDocument> {
    const primary = d.clinicIds[0]
      ? await this.clinics.findById(d.clinicIds[0], { address: 1 }).exec()
      : null;
    d.city = primary ? primary.address.city.trim().toLowerCase() : undefined;
    // Slugs follow the name and primary city until first listed, then never change.
    const wanted = d.slugLocked ? null : baseSlug(d.name, primary?.address.city ?? '');
    d.isListed = computeIsListed(d);
    // Always write the value just computed, even if it equals what this copy loaded.
    d.markModified('isListed');
    if (d.isListed) d.slugLocked = true;
    let retry = false;
    return retryOnSlugConflict(async () => {
      const current = d.slug.replace(/-\d+$/, '');
      if (wanted && (retry || (wanted !== current && wanted !== d.slug))) {
        d.slug = await uniqueSlug(wanted, (s) => this.slugTaken(s, d._id));
      }
      retry = true;
      return d.save();
    });
  }

  async refreshListingById(doctorId: Types.ObjectId): Promise<void> {
    const d = await this.doctors.findById(doctorId).exec();
    if (d) await this.saveWithListing(d);
  }

  /** Registration details changed: back to pending review, off the listing until approved. */
  private resubmit(d: DoctorDocument): void {
    d.verification.status = 'pending';
    d.verification.submittedAt = new Date();
    d.verification.verifiedAt = undefined;
    d.verification.verifiedBy = undefined;
  }

  private async slugTaken(slug: string, except?: Types.ObjectId): Promise<boolean> {
    const filter = except ? { slug, _id: { $ne: except } } : { slug };
    return (await this.doctors.exists(filter).exec()) !== null;
  }
}
