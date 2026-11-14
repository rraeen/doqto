import {
  CreateLabCategoryRequestSchema,
  CreateLabTestRequestSchema,
  LAB_BOOKING_STATUSES,
  LabAssignRequestSchema,
  LabBookingDecisionRequestSchema,
  LabProgressRequestSchema,
  UpdateLabTestRequestSchema,
  type LabBookingStatus,
  type LabCatalogue,
  type LabCollectors,
  type LabConsoleBooking,
  type LabConsoleBookingList,
  type LabTest as LabTestDto,
  type LabCategory as LabCategoryDto,
  type Workspace,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/http/app-exception';
import { storeOrReject, type UploadedBlob } from '../common/http/upload';
import { zodCheck } from '../common/http/zod-check';
import { AppConfig } from '../config/app-config.service';
import { Account } from '../console-auth/account.schema';
import { Membership } from '../console-auth/organization.schema';
import { requirePermission, WorkspacesService } from '../console-auth/workspaces.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../integrations';
import {
  LabBooking,
  LabCategory,
  LabTest,
  type LabBookingDocument,
} from './lab.schema';
import { toCatalogue, toConsoleBooking, toLabTest } from './lab-presenters';
import { LabsService } from './labs.service';

const REPORT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const entry = (status: LabBookingStatus, at = new Date()) => ({ status, at });

/**
 * The lab's side in the console. Every route names the lab service in its path; the member must
 * belong to it and hold the permission for what they do (the owner holds them all):
 * `catalogue` (tests and prices), `bookings` (accept or reject, close), `collection` (collect
 * samples, assign who collects) and `reports` (processing and the report file).
 */
@Injectable()
export class ConsoleLabService {
  constructor(
    @InjectModel(LabCategory.name) private readonly categories: Model<LabCategory>,
    @InjectModel(LabTest.name) private readonly tests: Model<LabTest>,
    @InjectModel(LabBooking.name) private readonly bookings: Model<LabBooking>,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly workspaces: WorkspacesService,
    private readonly patientSide: LabsService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** The approved lab of this account, if the member holds one of the permissions. */
  private async scope(accountId: string, unitId: string, ...anyOf: string[]): Promise<Workspace> {
    const ws = await this.workspaces.open(accountId, unitId);
    if (ws.kind !== 'lab') throw AppException.notFound('This service is not a lab');
    requirePermission(ws, ...anyOf);
    if (ws.status !== 'verified') {
      throw AppException.forbidden('The lab opens once Doqto approves your application');
    }
    return ws;
  }

  // ---- catalogue -----------------------------------------------------------------------------

  async catalogue(accountId: string, unitId: string): Promise<LabCatalogue> {
    await this.scope(accountId, unitId, 'catalogue');
    const uid = new Types.ObjectId(unitId);
    const [categories, tests] = await Promise.all([
      this.categories.find({ unitId: uid }).exec(),
      this.tests.find({ unitId: uid }).exec(),
    ]);
    return toCatalogue(categories, tests);
  }

  async createCategory(accountId: string, unitId: string, body: unknown): Promise<LabCategoryDto> {
    await this.scope(accountId, unitId, 'catalogue');
    const input = zodCheck(CreateLabCategoryRequestSchema, body);
    try {
      const c = await this.categories.create({ unitId: new Types.ObjectId(unitId), name: input.name });
      return { id: c._id.toHexString(), name: c.name };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'You already have this category.');
      }
      throw e;
    }
  }

  /** A category must belong to this lab. */
  private async categoryName(unitId: string, categoryId: string | null | undefined) {
    if (!categoryId) return { id: undefined, name: null };
    const c = isValidObjectId(categoryId)
      ? await this.categories.findOne({ _id: categoryId, unitId: new Types.ObjectId(unitId) }).exec()
      : null;
    if (!c) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: [{ path: 'categoryId', message: 'Choose one of your categories' }],
      });
    }
    return { id: c._id, name: c.name };
  }

  async createTest(accountId: string, unitId: string, body: unknown): Promise<LabTestDto> {
    await this.scope(accountId, unitId, 'catalogue');
    const input = zodCheck(CreateLabTestRequestSchema, body);
    const category = await this.categoryName(unitId, input.categoryId);
    const t = await this.tests.create({
      unitId: new Types.ObjectId(unitId),
      name: input.name,
      pricePaise: input.pricePaise,
      ...(category.id ? { categoryId: category.id } : {}),
      ...(input.sampleType ? { sampleType: input.sampleType } : {}),
      ...(input.preparation ? { preparation: input.preparation } : {}),
      ...(input.turnaroundHours ? { turnaroundHours: input.turnaroundHours } : {}),
      homeCollection: input.homeCollection ?? false,
      active: input.active ?? true,
    });
    return toLabTest(t, category.name);
  }

  async updateTest(accountId: string, unitId: string, testId: string, body: unknown): Promise<LabTestDto> {
    await this.scope(accountId, unitId, 'catalogue');
    const input = zodCheck(UpdateLabTestRequestSchema, body);
    const t = isValidObjectId(testId)
      ? await this.tests.findOne({ _id: testId, unitId: new Types.ObjectId(unitId) }).exec()
      : null;
    if (!t) throw AppException.notFound('Test not found');
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const key of ['name', 'pricePaise', 'homeCollection', 'active'] as const) {
      if (input[key] !== undefined) set[key] = input[key];
    }
    for (const key of ['sampleType', 'preparation', 'turnaroundHours'] as const) {
      if (input[key] === undefined) continue;
      if (input[key] === null) unset[key] = '';
      else set[key] = input[key];
    }
    if (input.categoryId !== undefined) {
      const c = await this.categoryName(unitId, input.categoryId);
      if (c.id) set.categoryId = c.id;
      else unset.categoryId = '';
    }
    const updated = await this.tests
      .findOneAndUpdate(
        { _id: t._id },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { new: true },
      )
      .exec();
    const category = updated?.categoryId ? await this.categories.findById(updated.categoryId).exec() : null;
    return toLabTest(updated!, category?.name ?? null);
  }

  // ---- bookings ------------------------------------------------------------------------------

  private async assignees(rows: LabBookingDocument[]) {
    const ids = [...new Set(rows.flatMap((r) => (r.assignedToAccountId ? [r.assignedToAccountId] : [])))];
    const accounts = ids.length ? await this.accounts.find({ _id: { $in: ids } }, { name: 1 }).exec() : [];
    return new Map(accounts.map((a) => [a._id.toHexString(), { id: a._id.toHexString(), name: a.name }]));
  }

  private async view(rows: LabBookingDocument[]): Promise<LabConsoleBooking[]> {
    const names = await this.assignees(rows);
    return rows.map((b) =>
      toConsoleBooking(b, b.assignedToAccountId ? (names.get(b.assignedToAccountId.toHexString()) ?? null) : null),
    );
  }

  /** Newest day first. Any of the booking permissions opens the list. */
  async list(accountId: string, unitId: string, status?: string): Promise<LabConsoleBookingList> {
    await this.scope(accountId, unitId, 'bookings', 'collection', 'reports');
    await this.patientSide.expireStale();
    const filter: Record<string, unknown> = { unitId: new Types.ObjectId(unitId) };
    if (status) {
      if (!(LAB_BOOKING_STATUSES as readonly string[]).includes(status)) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Unknown status');
      }
      filter.status = status;
    }
    const rows = await this.bookings.find(filter).sort({ date: -1, createdAt: -1 }).limit(200).exec();
    return { items: await this.view(rows), reportsEnabled: this.config.labReportsEnabled };
  }

  private async load(unitId: string, bookingId: string): Promise<LabBookingDocument> {
    const b = isValidObjectId(bookingId)
      ? await this.bookings.findOne({ _id: bookingId, unitId: new Types.ObjectId(unitId) }).exec()
      : null;
    if (!b) throw AppException.notFound('Booking not found');
    return b;
  }

  /** Moves the booking one step, only from a status it is allowed to leave. */
  private async step(
    b: LabBookingDocument,
    from: LabBookingStatus[],
    to: LabBookingStatus,
    extra: Record<string, unknown> = {},
  ): Promise<LabBookingDocument> {
    const updated = await this.bookings
      .findOneAndUpdate(
        { _id: b._id, status: { $in: from } },
        { $set: { status: to, ...extra }, $push: { statusHistory: entry(to) } },
        { new: true },
      )
      .exec();
    if (!updated) {
      // Lost a race (the patient cancelled, or someone else got there first): say what it is now.
      const now = await this.bookings.findById(b._id, { status: 1 }).exec();
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This booking has changed. Refresh to see where it is now.',
        { status: now?.status ?? b.status },
      );
    }
    return updated;
  }

  async decide(accountId: string, unitId: string, bookingId: string, body: unknown): Promise<LabConsoleBooking> {
    await this.scope(accountId, unitId, 'bookings');
    const input = zodCheck(LabBookingDecisionRequestSchema, body);
    const b = await this.load(unitId, bookingId);
    const updated =
      input.decision === 'accept'
        ? await this.step(b, ['requested'], 'accepted')
        : await this.step(b, ['requested'], 'rejected', { rejectReason: input.reason });
    await this.record(accountId, `lab.booking.${input.decision}`, updated);
    return (await this.view([updated]))[0]!;
  }

  async progress(accountId: string, unitId: string, bookingId: string, body: unknown): Promise<LabConsoleBooking> {
    const input = zodCheck(LabProgressRequestSchema, body);
    const rule = {
      collected: { perm: 'collection', from: ['accepted'], to: 'sample_collected' },
      no_show: { perm: 'collection', from: ['accepted'], to: 'no_show' },
      processing: { perm: 'reports', from: ['sample_collected'], to: 'processing' },
      completed: { perm: 'bookings', from: ['report_ready'], to: 'completed' },
    } as const;
    const r = rule[input.step];
    await this.scope(accountId, unitId, r.perm);
    const b = await this.load(unitId, bookingId);
    const updated = await this.step(b, [...r.from], r.to);
    await this.record(accountId, `lab.booking.${r.to}`, updated);
    return (await this.view([updated]))[0]!;
  }

  /** Who collects the sample: the owner, or a staff member who has the collection permission. */
  async collectors(accountId: string, unitId: string): Promise<LabCollectors> {
    await this.scope(accountId, unitId, 'bookings', 'collection');
    const members = await this.memberships.find({ unitId: new Types.ObjectId(unitId) }).exec();
    const eligible = members.filter((m) => m.role === 'owner' || m.permissions.includes('collection'));
    const accounts = await this.accounts
      .find({ _id: { $in: eligible.map((m) => m.accountId) }, status: 'active' }, { name: 1 })
      .exec();
    return { items: accounts.map((a) => ({ accountId: a._id.toHexString(), name: a.name })) };
  }

  async assign(accountId: string, unitId: string, bookingId: string, body: unknown): Promise<LabConsoleBooking> {
    await this.scope(accountId, unitId, 'collection', 'bookings');
    const input = zodCheck(LabAssignRequestSchema, body);
    const b = await this.load(unitId, bookingId);
    if (b.status !== 'accepted') {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Collection can be assigned once the booking is accepted.', {
        status: b.status,
      });
    }
    if (input.accountId) {
      const eligible = (await this.collectors(accountId, unitId)).items.some((c) => c.accountId === input.accountId);
      if (!eligible) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
          issues: [{ path: 'accountId', message: 'Choose someone who collects samples' }],
        });
      }
      b.assignedToAccountId = new Types.ObjectId(input.accountId);
    } else {
      b.assignedToAccountId = undefined;
    }
    await b.save();
    return (await this.view([b]))[0]!;
  }

  // ---- reports (behind LAB_REPORTS_ENABLED) --------------------------------------------------

  /** Stores the report and tells the patient it is ready. Replacing a report keeps the booking ready. */
  async uploadReport(
    accountId: string,
    unitId: string,
    bookingId: string,
    file: UploadedBlob,
  ): Promise<LabConsoleBooking> {
    await this.scope(accountId, unitId, 'reports');
    if (!this.config.labReportsEnabled) throw AppException.notFound('Reports are not available yet');
    const b = await this.load(unitId, bookingId);
    if (!['sample_collected', 'processing', 'report_ready'].includes(b.status)) {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'A report can be added after the sample is collected.', {
        status: b.status,
      });
    }
    const ext = REPORT_TYPES[file.mimetype] ?? 'bin';
    const stored = await storeOrReject(() =>
      this.storage.putPrivate({
        key: `labreports/${unitId}/${b._id.toHexString()}/${randomUUID()}.${ext}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    const oldKey = b.reportKey;
    const report = {
      reportKey: stored.key,
      reportUploadedAt: new Date(),
      reportUploadedBy: new Types.ObjectId(accountId),
    };
    try {
      const updated =
        b.status === 'report_ready'
          ? await this.bookings.findOneAndUpdate({ _id: b._id }, { $set: report }, { new: true }).exec()
          : await this.step(b, ['sample_collected', 'processing'], 'report_ready', report);
      if (oldKey && oldKey !== stored.key) await this.storage.deletePrivate(oldKey).catch(() => undefined);
      await this.record(accountId, 'lab.report.upload', updated!);
      return (await this.view([updated!]))[0]!;
    } catch (e) {
      // Do not leave a file nobody can reach.
      await this.storage.deletePrivate(stored.key).catch(() => undefined);
      throw e;
    }
  }

  private async record(accountId: string, action: string, b: LabBookingDocument): Promise<void> {
    await this.audit.record({
      actorUserId: accountId,
      action,
      entity: 'labBookings',
      entityId: b._id,
      after: { status: b.status },
    });
  }
}
