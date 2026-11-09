import {
  checkUnitProfile,
  type ProfileChangeDecisionRequest,
  type ProfileChangeDetail,
  type ProfileChangeList,
  type ProfileChangeSummary,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/http/app-exception';
import { Account } from './account.schema';
import { Organization, Unit, type UnitDocument } from './organization.schema';
import { UnitProfileService, changedFields } from './unit-profile.service';
import { UnitPublishingService } from './unit-publishing.service';

/**
 * The Doqto team's review of changes doctors made to their profile. Approving puts the change on the
 * patient site (name, details and photo); rejecting keeps the old profile and tells the doctor why.
 */
@Injectable()
export class PlatformProfileChangesService {
  constructor(
    @InjectModel(Unit.name) private readonly units: Model<Unit>,
    @InjectModel(Organization.name) private readonly organizations: Model<Organization>,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    private readonly audit: AuditService,
    private readonly publishing: UnitPublishingService,
    private readonly profiles: UnitProfileService,
  ) {}

  /** Waiting changes, the oldest first. */
  async list(): Promise<ProfileChangeList> {
    const units = await this.units
      .find({ kind: 'clinic', status: 'verified', 'pendingChange.status': 'pending' })
      .sort({ 'pendingChange.submittedAt': 1 })
      .limit(200)
      .exec();
    return { items: await Promise.all(units.map((u) => this.summary(u))) };
  }

  async detail(unitId: string): Promise<ProfileChangeDetail> {
    const unit = await this.waiting(unitId);
    const current = await this.profiles.snapshot(unit);
    const p = unit.pendingChange!;
    return {
      ...(await this.summary(unit)),
      current,
      proposed: { profile: p.profile, photoUrl: p.photoUrl ?? current.photoUrl },
    };
  }

  async decide(
    reviewer: { id: string },
    unitId: string,
    input: ProfileChangeDecisionRequest,
    now = new Date(),
  ): Promise<ProfileChangeList> {
    const unit = await this.waiting(unitId);
    const change = unit.pendingChange!;
    const filter = { _id: unit._id, status: 'verified', 'pendingChange.status': 'pending' };
    const before = {
      changed: changedFields(unit.profile ?? {}, change.profile),
      photo: Boolean(change.photoUrl),
    };

    if (input.decision === 'reject') {
      const r = await this.units
        .updateOne(filter, {
          $set: {
            'pendingChange.status': 'rejected',
            'pendingChange.reviewNote': input.note,
            'pendingChange.reviewedAt': now,
            'pendingChange.reviewedBy': new Types.ObjectId(reviewer.id),
          },
        })
        .exec();
      if (r.matchedCount === 0) throw this.alreadyDecided();
    } else {
      // The answers were checked when saved, but the form may have grown since: check again.
      const res = checkUnitProfile('clinic', change.profile);
      if (!res.ok) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_FAILED',
          'This change is missing details the patient listing needs.',
          { issues: res.issues.map((i) => ({ path: i.path, message: i.message })) },
        );
      }
      const old = await this.units
        .findOneAndUpdate(
          filter,
          {
            $set: { profile: res.profile, name: String(res.profile.displayName), reviewedAt: now },
            $unset: { pendingChange: '' },
          },
          { new: false },
        )
        .exec();
      if (!old) throw this.alreadyDecided();
      try {
        const updated = (await this.units.findById(unit._id).exec())!;
        const org = await this.organizations.findById(updated.organizationId).exec();
        if (org) await this.publishing.sync(updated, org.ownerAccountId);
        if (change.photoKey && change.photoUrl) {
          await this.publishing.setPhoto(updated._id, change.photoKey, change.photoUrl);
        }
      } catch (e) {
        // Never leave a change approved that is not on the site: put it back in the queue.
        await this.units
          .updateOne(
            { _id: unit._id },
            { $set: { profile: old.profile, name: old.name, pendingChange: old.pendingChange } },
          )
          .exec();
        throw e;
      }
    }
    await this.audit.record({
      actorUserId: reviewer.id,
      action: `profile_change.${input.decision}`,
      entity: 'unit',
      entityId: unit._id,
      before: { fields: before.changed, photo: before.photo },
      after: { decision: input.decision },
    });
    return this.list();
  }

  private alreadyDecided(): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      'CONFLICT',
      'This change was already decided or withdrawn.',
    );
  }

  /** A unit with a change waiting for a decision. */
  private async waiting(unitId: string): Promise<UnitDocument> {
    const unit = Types.ObjectId.isValid(unitId)
      ? await this.units
          .findOne({
            _id: unitId,
            kind: 'clinic',
            status: 'verified',
            'pendingChange.status': 'pending',
          })
          .exec()
      : null;
    if (!unit?.pendingChange) throw AppException.notFound('No change is waiting for this doctor');
    return unit;
  }

  private async summary(unit: UnitDocument): Promise<ProfileChangeSummary> {
    const org = await this.organizations.findById(unit.organizationId).exec();
    const owner = org
      ? await this.accounts.findById(org.ownerAccountId, { name: 1, email: 1, phone: 1 }).exec()
      : null;
    const p = unit.pendingChange!;
    return {
      id: unit._id.toHexString(),
      name: unit.name,
      submittedAt: p.submittedAt.toISOString(),
      changedFields: changedFields(unit.profile ?? {}, p.profile),
      photoChanged: Boolean(p.photoUrl),
      applicant: {
        name: owner?.name ?? '',
        email: owner?.email ?? null,
        phone: owner?.phone ?? null,
      },
    };
  }
}
