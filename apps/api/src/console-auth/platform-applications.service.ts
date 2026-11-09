import {
  UNIT_STATUSES,
  type ApplicationCounts,
  type ApplicationDecisionRequest,
  type ApplicationDetail,
  type ApplicationList,
  type ApplicationSummary,
  type UnitStatus,
  type WorkspaceType,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/http/app-exception';
import { Account } from './account.schema';
import { Organization, Unit, type UnitDocument } from './organization.schema';
import { UnitPublishingService } from './unit-publishing.service';

/** The review of provider applications by the Doqto team. */
@Injectable()
export class PlatformApplicationsService {
  constructor(
    @InjectModel(Unit.name) private readonly units: Model<Unit>,
    @InjectModel(Organization.name) private readonly organizations: Model<Organization>,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    private readonly audit: AuditService,
    private readonly publishing: UnitPublishingService,
  ) {}

  /** Applications with this status (or all submitted ones), newest submission first. */
  async list(filter: { status?: UnitStatus; kind?: WorkspaceType }): Promise<ApplicationList> {
    // A draft was never submitted, so it is not something to review.
    const query: Record<string, unknown> = { status: { $ne: 'draft' } };
    if (filter.status) query.status = filter.status;
    if (filter.kind) query.kind = filter.kind;
    const [units, grouped] = await Promise.all([
      this.units.find(query).sort({ submittedAt: -1, createdAt: -1 }).limit(200).exec(),
      this.units.aggregate<{ _id: UnitStatus; n: number }>([
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
    ]);
    const counts = Object.fromEntries(UNIT_STATUSES.map((s) => [s, 0])) as ApplicationCounts;
    for (const g of grouped) counts[g._id] = g.n;
    return { items: await this.summaries(units), counts };
  }

  async detail(unitId: string): Promise<ApplicationDetail> {
    const unit = await this.find(unitId);
    const [summary] = await this.summaries([unit]);
    const org = await this.organizations.findById(unit.organizationId).exec();
    const siblings = await this.units
      .find({
        organizationId: unit.organizationId,
        _id: { $ne: unit._id },
        status: { $ne: 'draft' },
      })
      .exec();
    return {
      ...summary!,
      profile: unit.profile ?? {},
      reviewNote: unit.reviewNote ?? null,
      organization: { id: unit.organizationId.toHexString(), name: org?.name ?? unit.name },
      siblings: siblings.map((u) => ({
        id: u._id.toHexString(),
        kind: u.kind,
        name: u.name,
        status: u.status,
      })),
    };
  }

  /**
   * Approves, sends back for changes, or rejects an application. Every decision is written to the
   * audit log with who made it. Approving needs an application waiting for review. Sending back or
   * rejecting also works on an approved one (to take a doctor off the site), but never on one that
   * was already sent back or rejected, so two reviewers cannot override each other by accident.
   */
  async decide(
    reviewer: { id: string },
    unitId: string,
    input: ApplicationDecisionRequest,
  ): Promise<ApplicationDetail> {
    const unit = await this.find(unitId);
    const next: UnitStatus =
      input.decision === 'approve'
        ? 'verified'
        : input.decision === 'request_changes'
          ? 'changes_requested'
          : 'rejected';
    const note = input.decision === 'approve' ? undefined : input.note;
    // An application the patient listing cannot be built from is sent back, not approved.
    if (input.decision === 'approve') this.publishing.assertPublishable(unit);
    const set: Record<string, unknown> = {
      status: next,
      reviewedAt: new Date(),
      reviewedBy: new Types.ObjectId(reviewer.id),
    };
    if (note) set.reviewNote = note;
    const updated = await this.units
      .findOneAndUpdate(
        {
          _id: unit._id,
          status: { $in: input.decision === 'approve' ? ['pending'] : ['pending', 'verified'] },
        },
        note ? { $set: set } : { $set: set, $unset: { reviewNote: '' } },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This application cannot be decided in its current state.',
        { status: unit.status },
      );
    }
    const org = await this.organizations.findById(updated.organizationId).exec();
    try {
      if (org) await this.publishing.sync(updated, org.ownerAccountId);
    } catch (e) {
      // Never leave an application approved that is not on the site: put it back in the queue.
      await this.units
        .updateOne(
          { _id: unit._id },
          { $set: { status: 'pending' }, $unset: { reviewedAt: '', reviewedBy: '' } },
        )
        .exec();
      throw e;
    }
    await this.audit.record({
      actorUserId: reviewer.id,
      action: `application.${input.decision}`,
      entity: 'unit',
      entityId: unit._id,
      before: { status: unit.status },
      after: { status: next, kind: unit.kind },
    });
    return this.detail(unitId);
  }

  private async find(unitId: string): Promise<UnitDocument> {
    if (!Types.ObjectId.isValid(unitId)) throw AppException.notFound('Application not found');
    const unit = await this.units.findById(unitId).exec();
    if (!unit) throw AppException.notFound('Application not found');
    return unit;
  }

  private async summaries(units: UnitDocument[]): Promise<ApplicationSummary[]> {
    const orgs = await this.organizations
      .find({ _id: { $in: units.map((u) => u.organizationId) } })
      .exec();
    const owners = await this.accounts
      .find({ _id: { $in: orgs.map((o) => o.ownerAccountId) } }, { name: 1, email: 1, phone: 1 })
      .exec();
    const orgById = new Map(orgs.map((o) => [o._id.toHexString(), o]));
    const ownerById = new Map(owners.map((a) => [a._id.toHexString(), a]));
    return units.map((u) => {
      const owner = ownerById.get(
        orgById.get(u.organizationId.toHexString())?.ownerAccountId.toHexString() ?? '',
      );
      return {
        id: u._id.toHexString(),
        kind: u.kind,
        name: u.name,
        status: u.status,
        submittedAt: u.submittedAt?.toISOString() ?? null,
        reviewedAt: u.reviewedAt?.toISOString() ?? null,
        applicant: {
          name: owner?.name ?? '',
          email: owner?.email ?? null,
          phone: owner?.phone ?? null,
        },
      };
    });
  }
}
