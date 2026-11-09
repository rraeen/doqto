import {
  type AdminDoctorDetail,
  type AdminDoctorQueueItem,
  type DoctorPrivateProfile,
  type Page,
  type VerificationStatus,
} from '@doqto/shared';
import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/http/app-exception';
import { Doctor, DoctorDocument } from '../doctors/doctor.schema';
import { toPrivateProfile } from '../doctors/doctor.mappers';
import { DoctorsService } from '../doctors/doctors.service';
import {
  INTEGRATIONS_CONFIG,
  STORAGE_PROVIDER,
  type IntegrationsConfig,
  type StorageProvider,
} from '../integrations';
import { User } from '../users/user.schema';

interface QueueCursor {
  c: string;
  i: string;
}

const submittedAt = (d: DoctorDocument): Date => d.verification.submittedAt ?? d.createdAt;

function encode(d: DoctorDocument): string {
  return Buffer.from(
    JSON.stringify({
      c: submittedAt(d).toISOString(),
      i: d._id.toHexString(),
    } satisfies QueueCursor),
  ).toString('base64url');
}

/** Scans are only ever served through short links (checklist E), whatever the global TTL. */
const DOCUMENT_URL_TTL_MAX_SECONDS = 300;

/** Fingerprint of everything the admin checks; any change by the doctor makes a stale decision 409. */
export function reviewToken(d: DoctorDocument): string {
  const r = d.registration;
  return createHash('sha256')
    .update(
      JSON.stringify([
        d.name,
        r.council,
        r.number,
        r.year,
        r.docKey ?? null,
        submittedAt(d).toISOString(),
        d.verification.status,
      ]),
    )
    .digest('base64url');
}

const conflict = (message: string) => new AppException(HttpStatus.CONFLICT, 'CONFLICT', message);

function decode(cursor: string | undefined): QueueCursor | undefined {
  if (!cursor) return undefined;
  try {
    const v = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as Partial<QueueCursor>;
    if (
      typeof v.c === 'string' &&
      !Number.isNaN(Date.parse(v.c)) &&
      typeof v.i === 'string' &&
      isValidObjectId(v.i)
    ) {
      return { c: v.c, i: v.i };
    }
  } catch {
    // fall through
  }
  throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor');
}

/** Admin doctor verification (BE-09). Every decision is written to auditLogs. */
@Injectable()
export class AdminDoctorsService {
  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(INTEGRATIONS_CONFIG) private readonly integrations: IntegrationsConfig,
    private readonly doctorsService: DoctorsService,
    private readonly audit: AuditService,
  ) {}

  /** Oldest submission first, keyset-paginated on `{ verification.status, verification.submittedAt, _id }`. */
  async queue(
    status: VerificationStatus,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<AdminDoctorQueueItem>> {
    const after = decode(cursor);
    const filter: Record<string, unknown> = { 'verification.status': status };
    if (after) {
      const c = new Date(after.c);
      filter.$or = [
        { 'verification.submittedAt': { $gt: c } },
        { 'verification.submittedAt': c, _id: { $gt: new Types.ObjectId(after.i) } },
      ];
    }
    const rows = await this.doctors
      .find(filter)
      .sort({ 'verification.submittedAt': 1, _id: 1 })
      .limit(limit + 1)
      .exec();
    const page = rows.slice(0, limit);
    const phones = new Map(
      (await this.users.find({ _id: { $in: page.flatMap((d) => (d.userId ? [d.userId] : [])) } }, { phone: 1 }).exec()).map(
        (u) => [u._id.toHexString(), u.phone] as const,
      ),
    );
    return {
      items: page.map((d) => ({
        id: d._id.toHexString(),
        name: d.name,
        phone: (d.userId && phones.get(d.userId.toHexString())) || null,
        city: d.city ?? null,
        specialties: d.specialties,
        registration: {
          council: d.registration.council,
          number: d.registration.number,
          year: d.registration.year,
        },
        documentUploaded: Boolean(d.registration.docKey),
        verificationStatus: d.verification.status,
        submittedAt: submittedAt(d).toISOString(),
      })),
      nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
    };
  }

  async detail(adminUserId: string, id: string): Promise<AdminDoctorDetail> {
    const d = await this.find(id);
    const user = d.userId ? await this.users.findById(d.userId, { phone: 1 }).exec() : null;
    const ttl = Math.min(DOCUMENT_URL_TTL_MAX_SECONDS, this.integrations.signedUrlTtlSeconds);
    const documentUrl = d.registration.docKey
      ? await this.storage.signedUrl(d.registration.docKey, ttl)
      : null;
    if (documentUrl) {
      // Who looked at a doctor's ID document (DPDP access trail).
      await this.audit.record({
        actorUserId: adminUserId,
        action: 'doctor.document.view',
        entity: 'doctors',
        entityId: d._id,
        after: { docKey: d.registration.docKey ?? null },
      });
    }
    return {
      doctor: toPrivateProfile(d),
      phone: user?.phone ?? null,
      reviewToken: reviewToken(d),
      documentUrl,
      documentUrlExpiresAt: documentUrl ? new Date(Date.now() + ttl * 1000).toISOString() : null,
    };
  }

  async decide(
    adminUserId: string,
    id: string,
    body: { decision: 'approve' | 'reject'; reviewToken: string; notes?: string },
  ): Promise<DoctorPrivateProfile> {
    const notes = body.notes?.trim() || undefined;
    if (body.decision === 'reject' && (!notes || notes.length < 5)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Explain the rejection in at least 5 characters',
        {
          issues: [{ path: 'notes', message: 'Required to reject (at least 5 characters)' }],
        },
      );
    }
    const d = await this.find(id);
    // A decision applies only to the exact pending submission the admin reviewed (RD BE-09 blocker).
    if (d.verification.status !== 'pending') {
      throw conflict('This doctor has already been decided. Reload the queue.');
    }
    if (body.reviewToken !== reviewToken(d)) {
      throw conflict(
        'The doctor changed their profile since you opened it. Reload and review again.',
      );
    }
    if (body.decision === 'approve' && !d.registration.docKey) {
      throw conflict('The doctor has not uploaded a registration document yet');
    }
    const before = { status: d.verification.status, isListed: d.isListed };
    const reviewed = {
      name: d.name,
      registration: {
        council: d.registration.council,
        number: d.registration.number,
        year: d.registration.year,
      },
      docKey: d.registration.docKey ?? null,
      submittedAt: submittedAt(d).toISOString(),
    };
    d.verification.status = body.decision === 'approve' ? 'verified' : 'rejected';
    d.verification.notes = notes;
    d.verification.verifiedBy = new Types.ObjectId(adminUserId);
    d.verification.verifiedAt = body.decision === 'approve' ? new Date() : undefined;
    // Optimistic concurrency: a concurrent decision or profile edit makes this save 409.
    const saved = await this.doctorsService.saveWithListing(d);
    await this.audit.record({
      actorUserId: adminUserId,
      action: `doctor.verify.${body.decision}`,
      entity: 'doctors',
      entityId: saved._id,
      before,
      after: {
        status: saved.verification.status,
        isListed: saved.isListed,
        notes: notes ?? null,
        reviewed,
      },
    });
    return toPrivateProfile(saved);
  }

  private async find(id: string): Promise<DoctorDocument> {
    const d = isValidObjectId(id) ? await this.doctors.findById(id).exec() : null;
    if (!d) throw AppException.notFound('Doctor not found');
    return d;
  }
}
