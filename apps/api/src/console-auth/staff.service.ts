import {
  CreateStaffRequestSchema,
  PERMISSIONS_BY_KIND,
  ResetStaffPasswordRequestSchema,
  UpdateStaffRequestSchema,
  type StaffList,
  type StaffMember,
  type Workspace,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { AccountSessionService } from './account-session.service';
import { Account, type AccountDocument } from './account.schema';
import { Membership } from './organization.schema';
import { PasswordService } from './password.service';
import { requireOwner, WorkspacesService } from './workspaces.service';

const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppException(HttpStatus.CONFLICT, 'CONFLICT', message, details);

function present(account: AccountDocument, membership: Membership): StaffMember {
  return {
    accountId: account._id.toHexString(),
    name: account.name,
    username: account.username ?? '',
    permissions: membership.permissions,
    status: account.status,
    mustChangePassword: account.mustChangePassword ?? false,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
  };
}

/**
 * The owner's staff logins: a username and a password the owner sets, and exactly the features the
 * owner switches on for this service. Everything here is owner-only. A staff login belongs to one
 * business; the owner can give the same login access to another of their services by adding the
 * same username there. The password is never stored or logged in plain form.
 */
@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    private readonly workspaces: WorkspacesService,
    private readonly passwords: PasswordService,
    private readonly sessions: AccountSessionService,
    private readonly audit: AuditService,
  ) {}

  /** The service, only for its owner, and only once Doqto has approved it. */
  private async ownerScope(ownerId: string, unitId: string): Promise<Workspace> {
    const ws = await this.workspaces.open(ownerId, unitId);
    requireOwner(ws);
    if (ws.status !== 'verified') {
      throw AppException.forbidden('Staff can be added once Doqto approves your application');
    }
    return ws;
  }

  /** Only features this kind of service has; each at most once. */
  private checkPermissions(ws: Workspace, permissions: string[]): string[] {
    const allowed: readonly string[] = PERMISSIONS_BY_KIND[ws.kind];
    const bad = permissions.filter((p) => !allowed.includes(p));
    if (bad.length > 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: [{ path: 'permissions', message: `Not available for this service: ${bad.join(', ')}` }],
      });
    }
    return [...new Set(permissions)];
  }

  /** The membership of a staff member of this service, or a 404 (never an owner). */
  private async staffMembership(unitId: string, accountId: string) {
    if (!Types.ObjectId.isValid(accountId)) throw AppException.notFound('Staff member not found');
    const membership = await this.memberships
      .findOne({
        unitId: new Types.ObjectId(unitId),
        accountId: new Types.ObjectId(accountId),
        role: 'staff',
      })
      .exec();
    if (!membership) throw AppException.notFound('Staff member not found');
    return membership;
  }

  /**
   * The clinic's own booking and queue code (shared with the older clinic routes) recognises people
   * through `staffUserIds`. Keep it in step with who is staff here; the permission checks in the
   * console routes still decide what each person may do.
   */
  private async syncClinicStaff(unitId: string, accountId: Types.ObjectId, on: boolean) {
    await this.clinics
      .updateOne(
        { unitId: new Types.ObjectId(unitId) },
        on ? { $addToSet: { staffUserIds: accountId } } : { $pull: { staffUserIds: accountId } },
      )
      .exec();
  }

  async list(ownerId: string, unitId: string): Promise<StaffList> {
    await this.ownerScope(ownerId, unitId);
    const members = await this.memberships
      .find({ unitId: new Types.ObjectId(unitId), role: 'staff' })
      .exec();
    const accounts = await this.accounts
      .find({ _id: { $in: members.map((m) => m.accountId) } })
      .exec();
    const byId = new Map(accounts.map((a) => [a._id.toHexString(), a]));
    const items = members.flatMap((m) => {
      const a = byId.get(m.accountId.toHexString());
      return a ? [present(a, m)] : [];
    });
    items.sort((a, b) => a.name.localeCompare(b.name));
    return { items };
  }

  async create(ownerId: string, unitId: string, body: unknown): Promise<StaffMember> {
    const ws = await this.ownerScope(ownerId, unitId);
    const input = zodCheck(CreateStaffRequestSchema, body);
    const permissions = this.checkPermissions(ws, input.permissions);
    const orgId = new Types.ObjectId(ws.organizationId);
    const unitOid = new Types.ObjectId(unitId);

    let account = await this.accounts.findOne({ username: input.username }).exec();
    if (account) {
      // The same login can serve more than one of this owner's services, nothing else.
      const sameBusiness = account.organizationId?.equals(orgId) ?? false;
      if (!sameBusiness) throw conflict('That username is taken. Choose another.');
      const already = await this.memberships.exists({ accountId: account._id, unitId: unitOid });
      if (already) throw conflict('That person already has access to this service.');
      // Added back after being removed from their last service: the login works again.
      if (account.status === 'suspended') {
        account.status = 'active';
        await account.save();
      }
    } else {
      try {
        account = await this.accounts.create({
          name: input.name,
          username: input.username,
          passwordHash: await this.passwords.hash(input.password),
          // No phone or email to confirm: the owner vouches for the person.
          contactVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
          mustChangePassword: true,
          createdByAccountId: new Types.ObjectId(ownerId),
          organizationId: orgId,
        });
      } catch (e) {
        if ((e as { code?: number }).code === 11000) {
          throw conflict('That username is taken. Choose another.');
        }
        throw e;
      }
    }

    const membership = await this.memberships.create({
      accountId: account._id,
      organizationId: orgId,
      unitId: unitOid,
      role: 'staff',
      permissions,
    });
    await this.syncClinicStaff(unitId, account._id, true);
    await this.audit.record({
      actorUserId: ownerId,
      action: 'staff.add',
      entity: 'unit',
      entityId: unitOid,
      after: { username: input.username, permissions },
    });
    return present(account, membership);
  }

  async update(
    ownerId: string,
    unitId: string,
    accountId: string,
    body: unknown,
  ): Promise<StaffMember> {
    const ws = await this.ownerScope(ownerId, unitId);
    const input = zodCheck(UpdateStaffRequestSchema, body);
    const membership = await this.staffMembership(unitId, accountId);
    const account = await this.accounts.findById(membership.accountId).exec();
    if (!account) throw AppException.notFound('Staff member not found');
    const before = { permissions: [...membership.permissions] };

    if (input.permissions) {
      membership.permissions = this.checkPermissions(ws, input.permissions);
      await membership.save();
    }
    if (input.name && input.name !== account.name) {
      account.name = input.name;
      await account.save();
    }
    await this.audit.record({
      actorUserId: ownerId,
      action: 'staff.update',
      entity: 'unit',
      entityId: unitId,
      before,
      after: { username: account.username, permissions: membership.permissions },
    });
    return present(account, membership);
  }

  /** A new temporary password: the person must choose their own at the next sign-in. */
  async resetPassword(
    ownerId: string,
    unitId: string,
    accountId: string,
    body: unknown,
  ): Promise<void> {
    await this.ownerScope(ownerId, unitId);
    const input = zodCheck(ResetStaffPasswordRequestSchema, body);
    const membership = await this.staffMembership(unitId, accountId);
    await this.accounts
      .updateOne(
        { _id: membership.accountId },
        {
          $set: {
            passwordHash: await this.passwords.hash(input.password),
            passwordChangedAt: new Date(),
            mustChangePassword: true,
            failedLogins: 0,
          },
          $unset: { lockedUntil: '' },
        },
      )
      .exec();
    await this.sessions.revokeAll(membership.accountId.toHexString());
    await this.audit.record({
      actorUserId: ownerId,
      action: 'staff.reset_password',
      entity: 'unit',
      entityId: unitId,
      after: { accountId },
    });
  }

  /** Takes the person off this service. With no service left the login is switched off. */
  async remove(ownerId: string, unitId: string, accountId: string): Promise<void> {
    await this.ownerScope(ownerId, unitId);
    const membership = await this.staffMembership(unitId, accountId);
    await this.memberships.deleteOne({ _id: membership._id }).exec();
    await this.syncClinicStaff(unitId, membership.accountId, false);
    const left = await this.memberships.countDocuments({ accountId: membership.accountId });
    if (left === 0) {
      await this.accounts.updateOne({ _id: membership.accountId }, { $set: { status: 'suspended' } });
      await this.sessions.revokeAll(membership.accountId.toHexString());
    }
    await this.audit.record({
      actorUserId: ownerId,
      action: 'staff.remove',
      entity: 'unit',
      entityId: unitId,
      after: { accountId },
    });
  }
}
