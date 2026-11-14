import {
  CreateLabBookingRequestSchema,
  LAB_PATIENT_CANCELLABLE,
  LAB_REQUEST_EXPIRY_HOURS,
  type LabBooking as LabBookingDto,
  type LabBookingList,
  type LabBookingStatus,
  type LabList,
  type LabProfile,
  type LabReportLink,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { addDays, istDate } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../integrations';
import { User } from '../users/user.schema';
import {
  Lab,
  LabBooking,
  LabCategory,
  LabTest,
  type LabBookingDocument,
  type LabDocument,
} from './lab.schema';
import { toCatalogue, toLabBooking } from './lab-presenters';

/** Most days ahead a patient can book, and requests that can wait for an answer at once. */
const BOOK_AHEAD_DAYS = 30;
const OPEN_REQUESTS_MAX = 10;
const REPORT_LINK_TTL_SECONDS = 300;
/** No 0/O, 1/I: easy to read out loud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const code = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const statusEntry = (status: LabBookingStatus, at = new Date()) => ({ status, at });

/**
 * Labs for patients: browsing the approved labs and their tests, sending a booking request,
 * following it and downloading the report. There is no payment: the lab accepts or rejects, and
 * the patient pays at the lab. A request nobody answers within a day expires.
 */
@Injectable()
export class LabsService {
  constructor(
    @InjectModel(Lab.name) private readonly labs: Model<Lab>,
    @InjectModel(LabCategory.name) private readonly categories: Model<LabCategory>,
    @InjectModel(LabTest.name) private readonly tests: Model<LabTest>,
    @InjectModel(LabBooking.name) private readonly bookings: Model<LabBooking>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  // ---- browsing (public) ---------------------------------------------------------------------

  /**
   * The listed labs. `city` narrows to one city; `q` finds labs by test name, lab name or city, so a
   * patient can search "thyroid" and get the labs that offer it.
   */
  async list(city?: string, q?: string): Promise<LabList> {
    const filter: Record<string, unknown> = { isListed: true };
    if (city?.trim()) filter.city = city.trim().toLowerCase();
    const needle = q?.trim().slice(0, 60);
    const matches = new Map<string, string[]>();
    if (needle) {
      const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const hits = await this.tests
        .find({ name: re, active: true }, { unitId: 1, name: 1 })
        .limit(500)
        .exec();
      for (const h of hits) {
        const key = h.unitId.toHexString();
        matches.set(key, [...(matches.get(key) ?? []), h.name]);
      }
      filter.$or = [
        { name: re },
        { cityLabel: re },
        { unitId: { $in: hits.map((h) => h.unitId) } },
      ];
    }
    const labs = await this.labs.find(filter).sort({ name: 1 }).limit(100).exec();
    const counts = await this.tests.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { unitId: { $in: labs.map((l) => l.unitId) }, active: true } },
      { $group: { _id: '$unitId', n: { $sum: 1 } } },
    ]);
    const byUnit = new Map(counts.map((c) => [c._id.toHexString(), c.n]));
    return {
      items: labs.map((l) => ({
        id: l._id.toHexString(),
        slug: l.slug,
        name: l.name,
        city: l.cityLabel,
        nablAccredited: l.nablAccredited,
        homeCollection: l.homeCollection,
        turnaroundHours: l.turnaroundHours ?? null,
        testCount: byUnit.get(l.unitId.toHexString()) ?? 0,
        matchedTests: (matches.get(l.unitId.toHexString()) ?? []).slice(0, 4),
      })),
    };
  }

  private async listed(slug: string): Promise<LabDocument> {
    const lab = await this.labs.findOne({ slug, isListed: true }).exec();
    if (!lab) throw AppException.notFound('Lab not found');
    return lab;
  }

  async profile(slug: string): Promise<LabProfile> {
    const lab = await this.listed(slug);
    const [categories, tests] = await Promise.all([
      this.categories.find({ unitId: lab.unitId }).exec(),
      this.tests.find({ unitId: lab.unitId, active: true }).exec(),
    ]);
    return {
      id: lab._id.toHexString(),
      slug: lab.slug,
      name: lab.name,
      city: lab.cityLabel,
      address: lab.address,
      nablAccredited: lab.nablAccredited,
      homeCollection: lab.homeCollection,
      turnaroundHours: lab.turnaroundHours ?? null,
      testCount: tests.length,
      matchedTests: [],
      catalogue: toCatalogue(categories, tests),
    };
  }

  // ---- bookings (the signed-in patient) ------------------------------------------------------

  /** Requests the lab never answered are closed, so they do not hang around for ever. */
  async expireStale(now = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - LAB_REQUEST_EXPIRY_HOURS * 3_600_000);
    await this.bookings
      .updateMany(
        { status: 'requested', createdAt: { $lt: cutoff } },
        { $set: { status: 'expired' }, $push: { statusHistory: statusEntry('expired', now) } },
      )
      .exec();
  }

  async create(userId: string, slug: string, raw: unknown, now = new Date()): Promise<LabBookingDto> {
    const body = zodCheck(CreateLabBookingRequestSchema, raw);
    const lab = await this.listed(slug);
    await this.expireStale(now);

    const today = istDate(now);
    if (body.date < today || body.date > addDays(today, BOOK_AHEAD_DAYS)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: [{ path: 'date', message: `Pick a day in the next ${BOOK_AHEAD_DAYS} days` }],
      });
    }

    const wanted = [...new Set(body.testIds)];
    const tests = await this.tests
      .find({ _id: { $in: wanted.map((id) => new Types.ObjectId(id)) }, unitId: lab.unitId, active: true })
      .exec();
    if (tests.length !== wanted.length) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: [{ path: 'testIds', message: 'Some of these tests are no longer offered' }],
      });
    }
    if (body.mode === 'home' && !(lab.homeCollection && tests.every((t) => t.homeCollection))) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: [{ path: 'mode', message: 'Home collection is not available for these tests' }],
      });
    }

    const owner = new Types.ObjectId(userId);
    const open = await this.bookings.countDocuments({ patientUserId: owner, status: 'requested' }).exec();
    if (open >= OPEN_REQUESTS_MAX) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'You have several requests waiting for a lab. Wait for an answer before sending more.',
      );
    }
    const user = await this.users.findById(owner, { phone: 1 }).lean().exec();
    if (!user) throw AppException.unauthenticated();

    const items = tests.map((t) => ({ testId: t._id, name: t.name, pricePaise: t.pricePaise }));
    const created = await this.bookings.create({
      patientUserId: owner,
      labId: lab._id,
      unitId: lab.unitId,
      code: code(),
      patientName: body.patientName,
      patientPhone: user.phone,
      items,
      totalPaise: items.reduce((sum, i) => sum + i.pricePaise, 0),
      mode: body.mode,
      date: body.date,
      window: body.window,
      ...(body.mode === 'home' ? { address: body.address } : {}),
      ...(body.note ? { note: body.note } : {}),
      status: 'requested',
      statusHistory: [statusEntry('requested', now)],
      isDemo: this.config.isDemo,
    });
    return toLabBooking(created, lab);
  }

  private async present(rows: LabBookingDocument[]): Promise<LabBookingDto[]> {
    const labs = await this.labs.find({ _id: { $in: rows.map((r) => r.labId) } }).exec();
    const byId = new Map(labs.map((l) => [l._id.toHexString(), l]));
    return rows.flatMap((b) => {
      const lab = byId.get(b.labId.toHexString());
      return lab ? [toLabBooking(b, lab)] : [];
    });
  }

  async mine(userId: string): Promise<LabBookingList> {
    await this.expireStale();
    const rows = await this.bookings
      .find({ patientUserId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return { items: await this.present(rows) };
  }

  private async owned(userId: string, id: string): Promise<LabBookingDocument> {
    const b = isValidObjectId(id)
      ? await this.bookings.findOne({ _id: id, patientUserId: new Types.ObjectId(userId) }).exec()
      : null;
    if (!b) throw AppException.notFound('Booking not found');
    return b;
  }

  async one(userId: string, id: string): Promise<LabBookingDto> {
    await this.expireStale();
    const [dto] = await this.present([await this.owned(userId, id)]);
    if (!dto) throw AppException.notFound('Booking not found');
    return dto;
  }

  /** Until the lab has the sample. Two taps, or a lab accepting at the same moment, cannot clash. */
  async cancel(userId: string, id: string, now = new Date()): Promise<LabBookingDto> {
    const b = await this.owned(userId, id);
    const updated = await this.bookings
      .findOneAndUpdate(
        { _id: b._id, status: { $in: LAB_PATIENT_CANCELLABLE } },
        {
          $set: { status: 'cancelled_by_patient' },
          $push: { statusHistory: statusEntry('cancelled_by_patient', now) },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'This booking can no longer be cancelled here. Contact the lab.',
        { status: b.status },
      );
    }
    const [dto] = await this.present([updated]);
    return dto!;
  }

  /** A link that works for 5 minutes. Switched off (404) while reports are not enabled. */
  async reportLink(userId: string, id: string, now = new Date()): Promise<LabReportLink> {
    if (!this.config.labReportsEnabled) throw AppException.notFound('Reports are not available yet');
    const b = await this.owned(userId, id);
    if (!b.reportKey || (b.status !== 'report_ready' && b.status !== 'completed')) {
      throw AppException.notFound('The report is not ready yet');
    }
    await this.audit.record({
      actorUserId: userId,
      action: 'lab.report.read',
      entity: 'labBookings',
      entityId: b._id,
    });
    return {
      url: await this.storage.signedUrl(b.reportKey, REPORT_LINK_TTL_SECONDS),
      expiresAt: new Date(now.getTime() + REPORT_LINK_TTL_SECONDS * 1000).toISOString(),
      fileName: `lab-report-${b.code}.${b.reportKey.split('.').pop() ?? 'pdf'}`,
    };
  }
}
