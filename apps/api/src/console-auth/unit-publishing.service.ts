import {
  BOOKING_FEE_MIN,
  CONSULT_FEE_MAX,
  checkUnitProfile,
  type SpecialtyKey,
} from '@doqto/shared';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { AppConfig } from '../config/app-config.service';
import { Clinic } from '../clinics/clinic.schema';
import { Doctor } from '../doctors/doctor.schema';
import { computeIsListed } from '../doctors/listing';
import { baseSlug, retryOnSlugConflict, uniqueSlug } from '../doctors/slug';
import type { UnitDocument } from './organization.schema';

const list = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * Puts an approved application on the patient site. A clinic or doctor application becomes a
 * `doctors` record (what search lists) and a `clinics` record (where they practise), linked back to
 * the unit by `unitId`. Approval again later updates those records; any other decision takes the
 * doctor off the list. Labs and pharmacies have no patient-facing list yet.
 */
@Injectable()
export class UnitPublishingService {
  private readonly logger = new Logger(UnitPublishingService.name);

  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    private readonly config: AppConfig,
  ) {}

  /**
   * Whether this unit could be published as it stands. Called before approving, so an application
   * that lacks something the patient listing needs is sent back for changes instead of approved.
   */
  assertPublishable(unit: Pick<UnitDocument, 'kind' | 'profile'>): void {
    if (unit.kind !== 'clinic') return;
    const res = checkUnitProfile('clinic', unit.profile ?? {});
    if (!res.ok) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'This application is missing details the patient listing needs. Ask for changes.',
        { issues: res.issues.map((i) => ({ path: i.path, message: i.message })) },
      );
    }
  }

  /** Brings the patient-facing records in step with the unit's status after a decision. */
  async sync(unit: UnitDocument, ownerAccountId: Types.ObjectId): Promise<void> {
    if (unit.kind !== 'clinic') return;
    if (unit.status === 'verified') await this.publishClinic(unit, ownerAccountId);
    else await this.unpublish(unit);
  }

  private async publishClinic(unit: UnitDocument, ownerAccountId: Types.ObjectId): Promise<void> {
    const res = checkUnitProfile('clinic', unit.profile ?? {});
    if (!res.ok) throw new Error('Approved clinic application is incomplete');
    const p = res.profile as Record<string, string | number | undefined>;
    const name = String(p.displayName);
    const city = String(p.city);

    const clinic =
      (await this.clinics.findOne({ unitId: unit._id }).exec()) ??
      new this.clinics({ unitId: unit._id, ownerAccountId, isDemo: this.config.isDemo });
    clinic.set({
      name,
      address: {
        line1: String(p.address),
        city,
        state: String(p.state),
        pincode: String(p.pincode),
      },
    });
    await clinic.save();

    const registration = {
      council: String(p.registrationCouncil),
      number: String(p.registrationNumber),
      year: Number(p.registrationYear),
    };
    const fields = {
      name,
      accountId: ownerAccountId,
      unitId: unit._id,
      bio: typeof p.about === 'string' && p.about ? p.about : undefined,
      languages: list(p.languages),
      qualifications: list(p.qualifications).map((degree) => ({ degree })),
      specialties: [String(p.specialty) as SpecialtyKey],
      experienceYears: Number(p.experienceYears),
      registration,
      clinicIds: [clinic._id],
      consultFee: Math.min(CONSULT_FEE_MAX, Math.round(Number(p.consultationFeeRupees) * 100)),
      // The booking fee is the platform's, not the doctor's: the lowest allowed until it is set.
      bookingFee: BOOKING_FEE_MIN,
      city: city.trim().toLowerCase(),
    };

    const existing = await this.doctors.findOne({ unitId: unit._id }).exec();
    const verification = { status: 'verified' as const, verifiedAt: new Date() };
    if (existing) {
      existing.set({ ...fields, verification: { ...existing.verification, ...verification } });
      existing.isListed = computeIsListed(existing);
      if (existing.isListed) existing.slugLocked = true;
      await existing.save();
    } else {
      await retryOnSlugConflict(async () => {
        const slug = await uniqueSlug(baseSlug(name, city), async (s) =>
          Boolean(await this.doctors.exists({ slug: s }).exec()),
        );
        const doctor = new this.doctors({
          ...fields,
          slug,
          verification,
          isDemo: this.config.isDemo,
        });
        doctor.isListed = computeIsListed(doctor);
        doctor.slugLocked = doctor.isListed;
        await doctor.save();
      });
    }
    // Doctors of the clinic, kept in step both ways.
    const doctor = await this.doctors.findOne({ unitId: unit._id }, { _id: 1 }).exec();
    if (doctor)
      await this.clinics
        .updateOne({ _id: clinic._id }, { $addToSet: { doctorIds: doctor._id } })
        .exec();
    this.logger.log(`Published clinic application ${unit._id.toHexString()} as a doctor listing`);
  }

  /** Puts an approved photo on the listing. */
  async setPhoto(unitId: Types.ObjectId, photoKey: string, photoUrl: string): Promise<void> {
    await this.doctors.updateOne({ unitId }, { $set: { photoKey, photoUrl } }).exec();
  }

  private async unpublish(unit: UnitDocument): Promise<void> {
    const status = unit.status === 'rejected' ? 'rejected' : 'pending';
    const r = await this.doctors
      .updateOne({ unitId: unit._id }, { $set: { isListed: false, 'verification.status': status } })
      .exec();
    if (r.modifiedCount > 0) {
      this.logger.log(`Took clinic application ${unit._id.toHexString()} off the patient site`);
    }
  }
}
