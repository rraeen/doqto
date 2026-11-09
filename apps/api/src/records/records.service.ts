import {
  CreateRecordFieldsSchema,
  RECORDS_MAX,
  RecordsQuerySchema,
  type HealthRecord,
  type HealthRecordsPage,
  type RecordFileLink,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types, type FilterQuery } from 'mongoose';
import { Appointment } from '../appointments/appointment.schema';
import { AppException } from '../common/http/app-exception';
import { decodeOffset, encodeOffset } from '../common/http/offset-cursor';
import { storeOrReject, type UploadedBlob } from '../common/http/upload';
import { zodCheck } from '../common/http/zod-check';
import { AppConfig } from '../config/app-config.service';
import { EXTENSION_BY_TYPE, STORAGE_PROVIDER, type StorageProvider } from '../integrations';
import { HealthRecordDoc, HealthRecordDocument } from './record.schema';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LINK_TTL_SECONDS = 300;

function toRecord(r: HealthRecordDocument): HealthRecord {
  return {
    id: r.id,
    kind: r.kind,
    visitType: r.visitType,
    title: r.title,
    doctorName: r.doctorName,
    facility: r.facility ?? '',
    date: r.date,
    status: r.status,
    appointmentId: r.appointmentId?.toHexString() ?? null,
    file: {
      name: r.file.name,
      contentType: r.file.contentType as HealthRecord['file']['contentType'],
      sizeBytes: r.file.sizeBytes,
    },
    createdAt: r.createdAt.toISOString(),
  };
}

/** A safe display name for the uploaded file: no path, no odd characters, at most 120 characters. */
export function cleanFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\p{L}\p{N} ._()-]/gu, '_')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/**
 * BE-43 the patient's own records: upload (PDF or image), list with search and filters, download
 * through a short-lived signed link, delete. Only the owner can see a record; another patient's id
 * is a 404. Doqto does not open the files (ADR 0007).
 */
@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    @InjectModel(HealthRecordDoc.name) private readonly records: Model<HealthRecordDoc>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly config: AppConfig,
  ) {}

  async create(userId: string, raw: unknown, file: UploadedBlob): Promise<HealthRecord> {
    const fields = zodCheck(CreateRecordFieldsSchema, raw);
    const owner = new Types.ObjectId(userId);
    if ((await this.records.countDocuments({ userId: owner }).exec()) >= RECORDS_MAX) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        `You can keep up to ${RECORDS_MAX} records. Delete some to add more.`,
      );
    }
    if (fields.appointmentId) {
      const own = await this.appointments
        .exists({ _id: fields.appointmentId, patientUserId: owner })
        .exec();
      if (!own) throw AppException.notFound('Appointment not found');
    }
    const _id = new Types.ObjectId();
    const ext = EXTENSION_BY_TYPE[file.mimetype] ?? 'bin';
    const stored = await storeOrReject(() =>
      this.storage.putPrivate({
        key: `records/${userId}/${_id.toHexString()}.${ext}`,
        body: file.buffer,
        contentType: file.mimetype,
      }),
    );
    try {
      const created = await this.records.create({
        _id,
        userId: owner,
        kind: fields.kind,
        visitType: fields.visitType,
        title: fields.title,
        doctorName: fields.doctorName,
        facility: fields.facility,
        date: fields.date,
        status: fields.status,
        ...(fields.appointmentId
          ? { appointmentId: new Types.ObjectId(fields.appointmentId) }
          : {}),
        file: {
          key: stored.key,
          name: cleanFileName(file.originalname, `record.${ext}`),
          contentType: stored.contentType,
          sizeBytes: stored.size,
        },
        isDemo: this.config.isDemo,
      });
      return toRecord(created);
    } catch (e) {
      // Do not leave a file nobody can reach.
      await this.storage.deletePrivate(stored.key).catch(() => undefined);
      throw e;
    }
  }

  async list(userId: string, rawQuery: unknown): Promise<HealthRecordsPage> {
    const q = zodCheck(RecordsQuerySchema, rawQuery);
    const owner = new Types.ObjectId(userId);
    const filter: FilterQuery<HealthRecordDoc> = { userId: owner };
    if (q.kind) filter.kind = { $in: q.kind.split(',') };
    if (q.visitType) filter.visitType = q.visitType;
    if (q.doctor) {
      const names = q.doctor.split('|').map((n) => n.trim()).filter(Boolean);
      filter.doctorName = { $in: names.map((n) => new RegExp(`^${escapeRegex(n)}$`, 'i')) };
    }
    if (q.from || q.to) {
      filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    }
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ title: rx }, { doctorName: rx }, { facility: rx }];
    }
    const offset = decodeOffset(q.cursor, RECORDS_MAX);
    const [rows, total, doctors] = await Promise.all([
      this.records
        .find(filter)
        .sort({ date: -1, _id: -1 })
        .skip(offset)
        .limit(q.limit + 1)
        .exec(),
      this.records.countDocuments(filter).exec(),
      this.records.distinct('doctorName', { userId: owner }).exec(),
    ]);
    return {
      items: rows.slice(0, q.limit).map(toRecord),
      nextCursor: rows.length > q.limit ? encodeOffset(offset + q.limit) : null,
      total,
      doctors: (doctors as string[]).sort((a, b) => a.localeCompare(b)),
    };
  }

  private async owned(userId: string, id: string): Promise<HealthRecordDocument> {
    const r = isValidObjectId(id)
      ? await this.records.findOne({ _id: id, userId: new Types.ObjectId(userId) }).exec()
      : null;
    if (!r) throw AppException.notFound('Record not found');
    return r;
  }

  /** A link that works for 5 minutes. The object key never leaves the server. */
  async fileLink(userId: string, id: string, now = new Date()): Promise<RecordFileLink> {
    const r = await this.owned(userId, id);
    return {
      url: await this.storage.signedUrl(r.file.key, LINK_TTL_SECONDS),
      expiresAt: new Date(now.getTime() + LINK_TTL_SECONDS * 1000).toISOString(),
      fileName: r.file.name,
      contentType: r.file.contentType as RecordFileLink['contentType'],
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const r = await this.owned(userId, id);
    await this.storage.deletePrivate(r.file.key);
    await this.records.deleteOne({ _id: r._id }).exec();
  }

  /** Account deletion: every record and file of the patient. */
  async deleteAllOf(userId: Types.ObjectId): Promise<void> {
    const rows = await this.records.find({ userId }, { 'file.key': 1 }).lean().exec();
    for (const r of rows) {
      await this.storage.deletePrivate(r.file.key).catch((e: unknown) => {
        this.logger.warn(
          `Could not delete a record file: ${e instanceof Error ? e.name : 'error'}`,
        );
      });
    }
    await this.records.deleteMany({ userId }).exec();
  }
}
