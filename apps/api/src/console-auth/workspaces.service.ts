import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  UNIT_NAME_FIELD,
  checkUnitProfile,
  type ProfileIssue,
  type UnitStatus,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceType,
} from '@doqto/shared';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import {
  Membership,
  Organization,
  Unit,
  type MembershipDocument,
  type UnitDocument,
} from './organization.schema';

function toWorkspace(unit: UnitDocument, membership: MembershipDocument): Workspace {
  return {
    id: unit._id.toHexString(),
    organizationId: unit.organizationId.toHexString(),
    kind: unit.kind,
    name: unit.name,
    status: unit.status,
    role: membership.role,
    reviewNote: unit.reviewNote ?? null,
  };
}

/**
 * Organizations, their units (clinic, lab, pharmacy) and who may open them. Sign-up creates an
 * organization; the owner then applies for the services they run (a unit with its own form and its
 * own approval). Only an approved unit opens a dashboard.
 * Access is decided here, on the server, for every console request that names a unit.
 */
@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Organization.name) private readonly organizations: Model<Organization>,
    @InjectModel(Unit.name) private readonly units: Model<Unit>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
  ) {}

  /** A new organization owned by `account`. It has no services until the owner sets them up. */
  async createFor(account: { id: Types.ObjectId; name: string }) {
    await this.organizations.create({ name: account.name, ownerAccountId: account.id });
  }

  /** Registering again before confirming replaces what the earlier attempt created. */
  async resetFor(account: { id: Types.ObjectId; name: string }) {
    const orgs = await this.organizations.find({ ownerAccountId: account.id }, { _id: 1 }).exec();
    const ids = orgs.map((o) => o._id);
    await this.memberships.deleteMany({ organizationId: { $in: ids } }).exec();
    await this.units.deleteMany({ organizationId: { $in: ids } }).exec();
    await this.organizations.deleteMany({ _id: { $in: ids } }).exec();
    await this.createFor(account);
  }

  async list(accountId: string | Types.ObjectId): Promise<Workspace[]> {
    const memberships = await this.memberships
      .find({ accountId: new Types.ObjectId(accountId) })
      .exec();
    if (memberships.length === 0) return [];
    const units = await this.units.find({ _id: { $in: memberships.map((m) => m.unitId) } }).exec();
    const byId = new Map(units.map((u) => [u._id.toHexString(), u]));
    const order: Record<WorkspaceType, number> = { clinic: 0, lab: 1, pharmacy: 2 };
    return memberships
      .flatMap((m) => {
        const unit = byId.get(m.unitId.toHexString());
        return unit ? [toWorkspace(unit, m)] : [];
      })
      .sort((a, b) => order[a.kind] - order[b.kind]);
  }

  /** The unit if this account is a member of it. Anything else looks like it does not exist. */
  async open(accountId: string, unitId: string): Promise<Workspace> {
    if (!Types.ObjectId.isValid(unitId)) throw AppException.notFound('Service not found');
    const membership = await this.memberships
      .findOne({ accountId: new Types.ObjectId(accountId), unitId: new Types.ObjectId(unitId) })
      .exec();
    const unit = membership ? await this.units.findById(membership.unitId).exec() : null;
    if (!membership || !unit) throw AppException.notFound('Service not found');
    return toWorkspace(unit, membership);
  }

  /** One service with the answers to its form, only if the account is a member of it. */
  async detail(accountId: string, unitId: string): Promise<WorkspaceDetail> {
    const workspace = await this.open(accountId, unitId);
    const unit = await this.units.findById(unitId).exec();
    return { ...workspace, profile: unit?.profile ?? {} };
  }

  /**
   * Applies for one or more services at once, each with its form. Every form is checked first and
   * nothing is saved unless all pass. A service that was saved but never submitted, or that Doqto
   * sent back for changes, is updated and submitted again; one already under review or approved
   * is refused. The services stay `pending` until Doqto approves them.
   */
  async apply(
    accountId: string,
    items: { kind: WorkspaceType; profile: Record<string, unknown> }[],
  ): Promise<Workspace[]> {
    const owner = new Types.ObjectId(accountId);
    const org = await this.organizations.findOne({ ownerAccountId: owner }).exec();
    if (!org) throw AppException.forbidden('Only the owner can apply for a service');

    const issues: ProfileIssue[] = [];
    const checked: { kind: WorkspaceType; profile: Record<string, unknown> }[] = [];
    for (const item of items) {
      const res = checkUnitProfile(item.kind, item.profile);
      if (res.ok) checked.push({ kind: item.kind, profile: res.profile });
      else issues.push(...res.issues.map((i) => ({ ...i, path: `${item.kind}.${i.path}` })));
    }
    if (issues.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Some fields are invalid',
        {
          issues,
        },
      );
    }

    const existing = await this.units.find({ organizationId: org._id }).exec();
    const byKind = new Map(existing.map((u) => [u.kind, u]));
    const open: UnitStatus[] = ['draft', 'changes_requested'];
    for (const { kind } of checked) {
      const unit = byKind.get(kind);
      if (unit && !open.includes(unit.status)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          unit.status === 'pending'
            ? 'This application is already being reviewed.'
            : 'You already have this service.',
          { kind },
        );
      }
    }

    for (const { kind, profile } of checked) {
      const name = String(profile[UNIT_NAME_FIELD[kind]] ?? org.name);
      const unit = byKind.get(kind);
      if (unit) {
        unit.set({ name, profile, status: 'pending', submittedAt: new Date() });
        await unit.save();
      } else {
        await this.addUnit(org, owner, kind, { name, profile, status: 'pending' });
      }
    }
    return this.list(owner);
  }

  private async addUnit(
    org: { _id: Types.ObjectId; name: string },
    accountId: Types.ObjectId,
    kind: WorkspaceType,
    init: { name?: string; profile?: Record<string, unknown>; status?: UnitStatus } = {},
  ): Promise<Workspace> {
    const unit = await this.units.create({
      organizationId: org._id,
      kind,
      name: init.name ?? org.name,
      profile: init.profile ?? {},
      status: init.status ?? 'draft',
      ...(init.status === 'pending' ? { submittedAt: new Date() } : {}),
    });
    const membership = await this.memberships.create({
      accountId,
      organizationId: org._id,
      unitId: unit._id,
      role: 'owner',
    });
    return toWorkspace(unit, membership);
  }
}
