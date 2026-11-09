import {
  PAGE_LIMIT_MAX,
  type DoctorListItem,
  type DoctorProfile,
  type Page,
  type SpecialtyKey,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { rankDoctors } from '../ranking/rank-doctors';
import { Doctor, DoctorDocument } from '../doctors/doctor.schema';
import { MIN_REVIEWS_FOR_SUMMARY, toListItem, toPublicProfile } from '../doctors/doctor.mappers';
import { istDate } from '../common/time/ist';
import { DoctorStatusService, toDoctorStatus } from '../status/doctor-status.service';

/** Ranked candidates per query. Phase 1 cities have tens of doctors, not thousands. */
const MAX_CANDIDATES = 500;

export interface SearchParams {
  city?: string;
  specialty?: SpecialtyKey;
  near?: { lat: number; lng: number };
  radiusKm: number;
  q?: string;
  cursor?: string;
  limit: number;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const { o } = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { o?: unknown };
    if (typeof o === 'number' && Number.isInteger(o) && o >= 0 && o <= MAX_CANDIDATES) return o;
  } catch {
    // fall through
  }
  throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor', {
    issues: [{ path: 'cursor', message: 'Invalid cursor' }],
  });
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Public search and profile (BE-10). Listed doctors only. */
@Injectable()
export class DoctorSearchService {
  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    private readonly status: DoctorStatusService,
  ) {}

  async search(p: SearchParams): Promise<Page<DoctorListItem> & { total: number }> {
    const offset = decodeCursor(p.cursor);
    const limit = Math.min(p.limit, PAGE_LIMIT_MAX);

    // Distance per clinic when searching near a point.
    const distances = new Map<string, number>();
    const filter: FilterQuery<Doctor> = { isListed: true };
    if (p.near) {
      const near = await this.clinics
        .aggregate<{ _id: Types.ObjectId; d: number }>([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [p.near.lng, p.near.lat] },
              distanceField: 'd',
              maxDistance: p.radiusKm * 1000,
              spherical: true,
            },
          },
          { $limit: MAX_CANDIDATES },
          { $project: { _id: 1, d: 1 } },
        ])
        .exec();
      for (const c of near) distances.set(c._id.toHexString(), c.d);
      filter.clinicIds = { $in: near.map((c) => c._id) };
    }
    if (p.city) filter.city = p.city.trim().toLowerCase();
    if (p.specialty) filter.specialties = p.specialty;
    if (p.q) filter.name = { $regex: escapeRegex(p.q), $options: 'i' };

    // Stable candidate set so the offset cursor sees the same pool on every page.
    const found = await this.doctors.find(filter).sort({ _id: 1 }).limit(MAX_CANDIDATES).exec();
    const clinicIds = [...new Set(found.flatMap((d) => d.clinicIds.map((id) => id.toHexString())))];
    const clinics = new Map(
      (await this.clinics.find({ _id: { $in: clinicIds } }).exec()).map(
        (c) => [c._id.toHexString(), c] as const,
      ),
    );

    const ranked = rankDoctors(
      found.map((d) => {
        const own = d.clinicIds.map((id) => id.toHexString());
        // Nearest of the doctor's clinics (or the first one without `near`).
        const nearestId = p.near
          ? own
              .filter((id) => distances.has(id))
              .sort((a, b) => distances.get(a)! - distances.get(b)!)[0]
          : own[0];
        const meters =
          nearestId !== undefined && p.near ? (distances.get(nearestId) ?? null) : null;
        const counted =
          d.ratingSummary && d.ratingSummary.count >= MIN_REVIEWS_FOR_SUMMARY
            ? d.ratingSummary
            : null;
        return {
          id: d._id.toHexString(),
          doctor: d,
          primary: nearestId ? clinics.get(nearestId) : undefined,
          meters,
          input: {
            distanceKm: meters === null ? null : meters / 1000,
            // Always true while the filter requires the specialty; kept for a later "related specialties" search.
            specialtyMatch: !p.specialty || d.specialties.includes(p.specialty),
            availability: 0,
            score: counted ? this.rankingScore(counted) : null,
            reviewCount: counted?.count ?? 0,
          },
        };
      }),
    );

    const pageItems = ranked.slice(offset, offset + limit);
    const next = offset + limit < ranked.length ? encodeCursor(offset + limit) : null;
    return {
      items: pageItems.map((r) =>
        toListItem(r.doctor, r.primary, r.meters === null ? null : Math.round(r.meters)),
      ),
      nextCursor: next,
      total: ranked.length,
    };
  }

  async profileBySlug(slug: string): Promise<DoctorProfile> {
    // Links carry the doctor's unique id (names repeat); a slug still works for old links.
    const byId = /^[a-f0-9]{24}$/.test(slug);
    const d: DoctorDocument | null = await this.doctors
      .findOne({ ...(byId ? { _id: slug } : { slug }), isListed: true })
      .exec();
    if (!d) throw AppException.notFound('Doctor not found');
    const clinics: ClinicDocument[] = await this.clinics.find({ _id: { $in: d.clinicIds } }).exec();
    const order = d.clinicIds.map((id) => id.toHexString());
    clinics.sort((a, b) => order.indexOf(a._id.toHexString()) - order.indexOf(b._id.toHexString()));
    const date = istDate();
    const status = toDoctorStatus(await this.status.find(d._id, date), d._id, date);
    return toPublicProfile(d, clinics, status);
  }

  /**
   * Ranking input only: the mean of the five dimensions (the Bayesian adjustment already happened
   * in the rating job). Never return it in a response: no single score is shown (TDD 5.4).
   */
  private rankingScore(r: NonNullable<Doctor['ratingSummary']>): number {
    return (r.waitTime + r.explanation + r.behaviour + r.facilities + r.valueForMoney) / 5;
  }
}
