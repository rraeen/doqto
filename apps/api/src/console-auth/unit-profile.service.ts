import {
  SaveProfileRequestSchema,
  UNIT_FORMS,
  checkUnitProfile,
  type MyProfile,
  type ProfileSnapshot,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { storeOrReject, type UploadedBlob } from '../common/http/upload';
import { zodCheck } from '../common/http/zod-check';
import { Doctor } from '../doctors/doctor.schema';
import { EXTENSION_BY_TYPE, STORAGE_PROVIDER, type StorageProvider } from '../integrations';
import type { PendingChange, UnitDocument } from './organization.schema';
import { Unit } from './organization.schema';
import { requireOwner, WorkspacesService } from './workspaces.service';

/** The clinic form fields whose answers differ. Both sides come from `checkUnitProfile`. */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const norm = (v: unknown) => JSON.stringify(v ?? null);
  return UNIT_FORMS.clinic.map((f) => f.key).filter((k) => norm(before[k]) !== norm(after[k]));
}

/**
 * The doctor's own profile. Edits (the form answers and the photo) are kept as one pending change
 * on the unit; the profile patients see is not touched until the Doqto team approves it.
 */
@Injectable()
export class UnitProfileService {
  constructor(
    @InjectModel(Unit.name) private readonly units: Model<Unit>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** The approved clinic service of this account; anything else cannot have a public profile. */
  private async own(accountId: string, unitId: string): Promise<UnitDocument> {
    const ws = await this.workspaces.open(accountId, unitId);
    if (ws.kind !== 'clinic') throw AppException.notFound('This service has no doctor profile');
    // The public profile (name, fees, registration, photo) is the owner's alone.
    requireOwner(ws);
    if (ws.status !== 'verified') {
      throw AppException.forbidden('The profile opens once Doqto approves your application');
    }
    const unit = await this.units.findById(unitId).exec();
    if (!unit) throw AppException.notFound('Service not found');
    return unit;
  }

  async view(unit: UnitDocument): Promise<MyProfile> {
    const doctor = await this.doctors
      .findOne({ unitId: unit._id }, { photoUrl: 1, isListed: 1 })
      .lean()
      .exec();
    const current: ProfileSnapshot = {
      profile: unit.profile ?? {},
      photoUrl: doctor?.photoUrl ?? null,
    };
    const p = unit.pendingChange;
    return {
      current,
      listed: doctor?.isListed ?? false,
      pending: p
        ? {
            profile: p.profile,
            photoUrl: p.photoUrl ?? current.photoUrl,
            status: p.status,
            reviewNote: p.status === 'rejected' ? (p.reviewNote ?? null) : null,
            submittedAt: p.submittedAt.toISOString(),
            changedFields: changedFields(current.profile, p.profile),
            photoChanged: Boolean(p.photoUrl),
          }
        : null,
    };
  }

  async get(accountId: string, unitId: string): Promise<MyProfile> {
    return this.view(await this.own(accountId, unitId));
  }

  /** Keeps the form as a pending change. Sending it again replaces the earlier one. */
  async save(
    accountId: string,
    unitId: string,
    raw: unknown,
    now = new Date(),
  ): Promise<MyProfile> {
    const unit = await this.own(accountId, unitId);
    const { profile } = zodCheck(SaveProfileRequestSchema, raw);
    const res = checkUnitProfile('clinic', profile);
    if (!res.ok) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Some fields are invalid',
        {
          issues: res.issues,
        },
      );
    }
    const keepsPhoto = Boolean(unit.pendingChange?.photoUrl);
    if (changedFields(unit.profile ?? {}, res.profile).length === 0 && !keepsPhoto) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Nothing was changed', {
        issues: [{ path: 'profile', message: 'Nothing was changed' }],
      });
    }
    return this.store(unit, {
      profile: res.profile,
      photoKey: unit.pendingChange?.photoKey,
      photoUrl: unit.pendingChange?.photoUrl,
      submittedAt: now,
      status: 'pending',
    });
  }

  /** A new photo. It joins the pending change (the form answers stay as they are). */
  async uploadPhoto(
    accountId: string,
    unitId: string,
    file: UploadedBlob,
    now = new Date(),
  ): Promise<MyProfile> {
    const unit = await this.own(accountId, unitId);
    const stored = await storeOrReject(() =>
      this.storage.putPublic({
        key: `units/${unit._id.toHexString()}/photo-${now.getTime()}.${EXTENSION_BY_TYPE[file.mimetype] ?? 'bin'}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    return this.store(unit, {
      profile: unit.pendingChange?.profile ?? unit.profile ?? {},
      photoKey: stored.key,
      photoUrl: stored.url,
      submittedAt: now,
      status: 'pending',
    });
  }

  /** Takes the pending change back (or dismisses a rejected one). */
  async withdraw(accountId: string, unitId: string): Promise<MyProfile> {
    const unit = await this.own(accountId, unitId);
    const updated = await this.units
      .findOneAndUpdate({ _id: unit._id }, { $unset: { pendingChange: '' } }, { new: true })
      .exec();
    return this.view(updated ?? unit);
  }

  private async store(unit: UnitDocument, change: PendingChange): Promise<MyProfile> {
    const updated = await this.units
      .findOneAndUpdate(
        { _id: unit._id, status: 'verified' },
        { $set: { pendingChange: change } },
        { new: true },
      )
      .exec();
    if (!updated) throw AppException.notFound('Service not found');
    return this.view(updated);
  }

  /** For the review: the approved snapshot of a unit. */
  async snapshot(unit: UnitDocument): Promise<ProfileSnapshot> {
    const doctor = await this.doctors
      .findOne({ unitId: unit._id as Types.ObjectId }, { photoUrl: 1 })
      .lean()
      .exec();
    return { profile: unit.profile ?? {}, photoUrl: doctor?.photoUrl ?? null };
  }
}
