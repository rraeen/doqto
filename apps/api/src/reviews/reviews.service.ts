import {
  CreateReviewRequestSchema,
  DoctorReviewsQuerySchema,
  RATING_DIMENSIONS,
  REVIEW_EDIT_DAYS,
  ReportReviewRequestSchema,
  UpdateReviewRequestSchema,
  canEditReview,
  reviewWindow,
  reviewWindowState,
  reviewerDisplayName,
  type DoctorReviewsPage,
  type MyReview,
  type MyReviewResponse,
  type ReviewEligibility,
  type ReviewEligibilityResponse,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from '../appointments/appointment.schema';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { decodeOffset, encodeOffset } from '../common/http/offset-cursor';
import { zodCheck } from '../common/http/zod-check';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { User } from '../users/user.schema';
import { maxSimilarity, scoreReview, verdictFor, type ScoreInput } from './fraud-score';
import { DEFAULT_MEANS, summarise, type DimensionMeans } from './rating-summary';
import { Review, ReviewDocument } from './review.schema';

const DAY = 86_400_000;
const isDuplicateKey = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;
const conflict = (message: string) => new AppException(HttpStatus.CONFLICT, 'CONFLICT', message);

/** When the visit ended: the consult end, else derived from the unlock time, else the slot end. */
export function visitEndedAt(a: {
  consultEndAt?: Date;
  reviewUnlockAt?: Date;
  slotEnd?: Date;
  updatedAt: Date;
}): Date {
  if (a.consultEndAt) return a.consultEndAt;
  if (a.reviewUnlockAt) return new Date(a.reviewUnlockAt.getTime() - DAY);
  return a.slotEnd ?? a.updatedAt;
}

export function toMyReview(r: ReviewDocument, now = Date.now()): MyReview {
  const submittedAt = r.submittedAt.toISOString();
  const editable = canEditReview({
    submittedAt,
    editedAt: r.editedAt?.toISOString() ?? null,
    now,
  });
  return {
    id: r.id,
    appointmentId: r.appointmentId.toHexString(),
    doctorId: r.doctorId.toHexString(),
    ratings: {
      waitTime: r.ratings.waitTime,
      explanation: r.ratings.explanation,
      behaviour: r.ratings.behaviour,
      facilities: r.ratings.facilities,
      valueForMoney: r.ratings.valueForMoney,
    },
    wouldRecommend: r.wouldRecommend,
    reason: r.visitReason,
    text: r.text ?? null,
    waitedMinutes: r.waitedMinutesReported ?? null,
    state: r.state,
    submittedAt,
    editedAt: r.editedAt?.toISOString() ?? null,
    canEditUntil: editable
      ? new Date(r.submittedAt.getTime() + REVIEW_EDIT_DAYS * DAY).toISOString()
      : null,
  };
}

/** BE-33 to BE-38 reviews: eligibility, submit, edit once, the public list, reports and the summary. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: AppConfig,
  ) {}

  // ------------------------------------------------------------------ eligibility

  /** The patient's finished, verified visits and whether each can be reviewed now. */
  async eligibility(userId: string, now = new Date()): Promise<ReviewEligibilityResponse> {
    const visits = await this.appointments
      .find({
        patientUserId: new Types.ObjectId(userId),
        status: 'completed',
        visitVerifiedAt: { $exists: true },
      })
      .sort({ _id: -1 })
      .limit(50)
      .lean()
      .exec();
    if (visits.length === 0) return { items: [] };
    const [doctors, clinics, existing] = await Promise.all([
      this.doctors
        .find({ _id: { $in: visits.map((v) => v.doctorId) } }, { name: 1, slug: 1 })
        .lean()
        .exec(),
      this.clinics
        .find({ _id: { $in: visits.map((v) => v.clinicId) } }, { name: 1 })
        .lean()
        .exec(),
      this.reviews
        .find({ appointmentId: { $in: visits.map((v) => v._id) } }, { appointmentId: 1 })
        .lean()
        .exec(),
    ]);
    const doctorById = new Map(doctors.map((d) => [d._id.toHexString(), d]));
    const clinicById = new Map(clinics.map((c) => [c._id.toHexString(), c]));
    const reviewOf = new Map(existing.map((r) => [r.appointmentId.toHexString(), r._id]));
    const items: ReviewEligibility[] = [];
    for (const v of visits) {
      const doctor = doctorById.get(v.doctorId.toHexString());
      if (!doctor) continue;
      const ended = visitEndedAt(v).toISOString();
      const window = reviewWindow(ended);
      const reviewId = reviewOf.get(v._id.toHexString());
      items.push({
        appointmentId: v._id.toHexString(),
        doctor: { id: doctor._id.toHexString(), name: doctor.name, slug: doctor.slug },
        clinicName: clinicById.get(v.clinicId.toHexString())?.name ?? '',
        visitEndedAt: ended,
        state: reviewId ? 'reviewed' : reviewWindowState(ended, now.getTime()),
        unlocksAt: window.unlocksAt,
        closesAt: window.closesAt,
        reviewId: reviewId?.toHexString() ?? null,
      });
    }
    items.sort((a, b) => Date.parse(b.visitEndedAt) - Date.parse(a.visitEndedAt));
    return { items };
  }

  // ------------------------------------------------------------------ submit and edit

  async create(userId: string, raw: unknown, now = new Date()): Promise<MyReviewResponse> {
    const body = zodCheck(CreateReviewRequestSchema, raw);
    const a = isValidObjectId(body.appointmentId)
      ? await this.appointments.findById(body.appointmentId).exec()
      : null;
    if (!a || a.patientUserId.toHexString() !== userId) {
      throw AppException.notFound('Visit not found');
    }
    if (a.status !== 'completed' || !a.visitVerifiedAt) {
      throw AppException.forbidden('Only a finished, verified visit can be reviewed');
    }
    const ended = visitEndedAt(a);
    const window = reviewWindowState(ended.toISOString(), now.getTime());
    if (window !== 'open') {
      throw AppException.forbidden(
        window === 'locked' ? 'The review form is not open yet' : 'The review window has closed',
      );
    }
    if (await this.reviews.exists({ appointmentId: a._id }).exec()) {
      throw conflict('You already reviewed this visit');
    }

    const scored = await this.score(a, body, now);
    const verdict = verdictFor(scored.score);
    let created: ReviewDocument;
    try {
      created = await this.reviews.create({
        doctorId: a.doctorId,
        appointmentId: a._id,
        patientUserId: a.patientUserId,
        ratings: body.ratings,
        wouldRecommend: body.wouldRecommend,
        visitReason: body.reason,
        ...(body.text ? { text: body.text } : {}),
        ...(body.waitedMinutes !== undefined ? { waitedMinutesReported: body.waitedMinutes } : {}),
        state: verdict.state,
        countsInSummary: verdict.countsInSummary,
        visitMonth: ended.toISOString().slice(0, 7),
        submittedAt: now,
        ...(verdict.state === 'published' ? { publishAt: now } : {}),
        fraud: { ...scored, scoredAt: now },
        isDemo: this.config.isDemo,
      });
    } catch (e) {
      // The unique index on appointmentId: a double tap or a second device.
      if (isDuplicateKey(e)) throw conflict('You already reviewed this visit');
      throw e;
    }
    await this.refreshDoctor(a.doctorId, now);
    return { review: toMyReview(created, now.getTime()) };
  }

  async update(
    userId: string,
    id: string,
    raw: unknown,
    now = new Date(),
  ): Promise<MyReviewResponse> {
    const body = zodCheck(UpdateReviewRequestSchema, raw);
    const r = isValidObjectId(id) ? await this.reviews.findById(id).exec() : null;
    if (!r || r.patientUserId.toHexString() !== userId) {
      throw AppException.notFound('Review not found');
    }
    if (
      !canEditReview({
        submittedAt: r.submittedAt.toISOString(),
        editedAt: r.editedAt?.toISOString() ?? null,
        now: now.getTime(),
      })
    ) {
      throw conflict('This review can no longer be edited');
    }
    const a = await this.appointments.findById(r.appointmentId).exec();
    const scored = a ? await this.score(a, body, now, r._id) : { score: 0, signals: [] };
    const verdict = verdictFor(scored.score);
    const updated = await this.reviews
      .findOneAndUpdate(
        // Once only: the filter fails if an earlier edit already landed.
        { _id: r._id, editedAt: { $exists: false } },
        {
          $set: {
            ratings: body.ratings,
            wouldRecommend: body.wouldRecommend,
            visitReason: body.reason,
            state: verdict.state,
            countsInSummary: verdict.countsInSummary,
            editedAt: now,
            fraud: { ...scored, scoredAt: now },
            ...(body.text ? { text: body.text } : {}),
            ...(body.waitedMinutes !== undefined
              ? { waitedMinutesReported: body.waitedMinutes }
              : {}),
            ...(verdict.state === 'published' ? { publishAt: r.publishAt ?? now } : {}),
          },
          $unset: {
            ...(body.text ? {} : { text: 1 }),
            ...(body.waitedMinutes !== undefined ? {} : { waitedMinutesReported: 1 }),
          },
          $inc: { editCount: 1 },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw conflict('This review can no longer be edited');
    await this.refreshDoctor(r.doctorId, now);
    return { review: toMyReview(updated, now.getTime()) };
  }

  async mine(userId: string, appointmentId: string): Promise<MyReviewResponse> {
    const r = isValidObjectId(appointmentId)
      ? await this.reviews
          .findOne({
            appointmentId: new Types.ObjectId(appointmentId),
            patientUserId: new Types.ObjectId(userId),
          })
          .exec()
      : null;
    if (!r) throw AppException.notFound('No review for this visit');
    return { review: toMyReview(r) };
  }

  // ------------------------------------------------------------------ public list and reports

  async publicList(doctorId: string, rawQuery: unknown): Promise<DoctorReviewsPage> {
    const q = zodCheck(DoctorReviewsQuerySchema, rawQuery);
    if (
      !isValidObjectId(doctorId) ||
      !(await this.doctors.exists({ _id: doctorId, isListed: true }).exec())
    ) {
      throw AppException.notFound('Doctor not found');
    }
    const offset = decodeOffset(q.cursor);
    const rows = await this.reviews
      .find({ doctorId: new Types.ObjectId(doctorId), state: 'published' })
      .sort({ publishAt: -1, _id: -1 })
      .skip(offset)
      .limit(q.limit + 1)
      .lean()
      .exec();
    const page = rows.slice(0, q.limit);
    const names = new Map(
      (
        await this.users
          .find({ _id: { $in: page.map((r) => r.patientUserId) } }, { name: 1 })
          .lean()
          .exec()
      ).map((u) => [u._id.toHexString(), u.name]),
    );
    return {
      items: page.map((r) => ({
        id: r._id.toHexString(),
        reviewerName: reviewerDisplayName(names.get(r.patientUserId.toHexString())),
        ratings: {
          waitTime: r.ratings.waitTime,
          explanation: r.ratings.explanation,
          behaviour: r.ratings.behaviour,
          facilities: r.ratings.facilities,
          valueForMoney: r.ratings.valueForMoney,
        },
        wouldRecommend: r.wouldRecommend,
        reason: r.visitReason,
        text: r.text ?? null,
        visitMonth: r.visitMonth,
        earlierVisit: Boolean(r.supersededBy),
        reply: r.reply ? { text: r.reply.text, at: r.reply.at.toISOString() } : null,
        publishedAt: (r.publishAt ?? r.submittedAt).toISOString(),
      })),
      nextCursor: rows.length > q.limit ? encodeOffset(offset + q.limit) : null,
    };
  }

  /** Anyone signed in can flag a review for the admins; flagging again is a no-op. */
  async report(userId: string, id: string, raw: unknown, now = new Date()): Promise<void> {
    const body = zodCheck(ReportReviewRequestSchema, raw);
    if (!isValidObjectId(id) || !(await this.reviews.exists({ _id: id }).exec())) {
      throw AppException.notFound('Review not found');
    }
    await this.reviews
      .updateOne(
        { _id: id, 'reports.userId': { $ne: new Types.ObjectId(userId) } },
        {
          $push: { reports: { userId: new Types.ObjectId(userId), reason: body.reason, at: now } },
        },
      )
      .exec();
  }

  // ------------------------------------------------------------------ scoring and the summary

  private async score(
    a: AppointmentDocument,
    body: { ratings: ScoreInput['ratings']; text?: string },
    now: Date,
    excludeReview?: Types.ObjectId,
  ) {
    const [user, doctor, walkIn, lastTexts, recent, month, oneStar] = await Promise.all([
      this.users.findById(a.patientUserId, { createdAt: 1 }).lean().exec(),
      this.doctors.findById(a.doctorId, { specialties: 1, city: 1 }).lean().exec(),
      this.appointments
        .findOne({ patientUserId: a.patientUserId, clinicId: a.clinicId, source: 'walk_in' })
        .sort({ _id: 1 })
        .lean()
        .exec(),
      this.reviews
        .find(
          {
            doctorId: a.doctorId,
            text: { $exists: true },
            ...(excludeReview ? { _id: { $ne: excludeReview } } : {}),
          },
          { text: 1 },
        )
        .sort({ _id: -1 })
        .limit(200)
        .lean()
        .exec(),
      this.reviews
        .countDocuments({
          doctorId: a.doctorId,
          submittedAt: { $gte: new Date(now.getTime() - 2 * DAY) },
          ...(excludeReview ? { _id: { $ne: excludeReview } } : {}),
        })
        .exec(),
      this.reviews
        .countDocuments({
          doctorId: a.doctorId,
          submittedAt: { $gte: new Date(now.getTime() - 30 * DAY) },
        })
        .exec(),
      this.reviews
        .find({
          patientUserId: a.patientUserId,
          'ratings.waitTime': 1,
          'ratings.explanation': 1,
          'ratings.behaviour': 1,
          'ratings.facilities': 1,
          'ratings.valueForMoney': 1,
          ...(excludeReview ? { _id: { $ne: excludeReview } } : {}),
        })
        .limit(20)
        .lean()
        .exec(),
    ]);
    const visitAt = visitEndedAt(a).getTime();
    // Other all-1 reviews by this patient, for doctors with the same specialty in the same city.
    let sameField = 0;
    if (oneStar.length > 0 && doctor) {
      const others = await this.doctors
        .find(
          {
            _id: { $in: oneStar.map((r) => r.doctorId) },
            city: doctor.city,
            specialties: { $in: doctor.specialties },
          },
          { _id: 1 },
        )
        .lean()
        .exec();
      sameField = others.length;
    }
    return scoreReview({
      ratings: body.ratings,
      text: body.text ?? null,
      accountAgeDaysAtVisit: user ? (visitAt - user.createdAt.getTime()) / DAY : 365,
      firstSeenAsWalkInHere: Boolean(walkIn),
      recentReviews: recent + 1,
      dailyAverage30d: month / 30,
      maxSimilarity: maxSimilarity(
        body.text,
        lastTexts.map((r) => r.text ?? ''),
      ),
      otherOneStarSameSpecialtyCity: sameField,
    });
  }

  /**
   * Re-derives which reviews of a doctor count (published, low fraud score, and the patient's
   * latest for this doctor), then rewrites the doctor's cached rating summary.
   */
  async refreshDoctor(doctorId: Types.ObjectId, now = new Date()): Promise<void> {
    const published = await this.reviews
      .find({ doctorId, state: 'published' })
      .sort({ submittedAt: -1 })
      .limit(2000)
      .exec();
    const newestByPatient = new Map<string, Types.ObjectId>();
    for (const r of published) {
      const key = r.patientUserId.toHexString();
      if (!newestByPatient.has(key)) newestByPatient.set(key, r._id);
    }
    const ops = [];
    const counted: ReviewDocument[] = [];
    for (const r of published) {
      const newest = newestByPatient.get(r.patientUserId.toHexString()) as Types.ObjectId;
      const latest = newest.equals(r._id);
      const supersededBy = latest ? undefined : newest;
      const lowFraud = (r.fraud?.score ?? 0) < 40;
      const counts = latest && lowFraud;
      if (latest && lowFraud) counted.push(r);
      const changed =
        r.countsInSummary !== counts || String(r.supersededBy ?? '') !== String(supersededBy ?? '');
      if (changed) {
        ops.push({
          updateOne: {
            filter: { _id: r._id },
            update: supersededBy
              ? { $set: { countsInSummary: counts, supersededBy } }
              : { $set: { countsInSummary: counts }, $unset: { supersededBy: 1 as const } },
          },
        });
      }
    }
    if (ops.length > 0) await this.reviews.bulkWrite(ops);
    const summary = summarise(
      counted.map((r) => ({
        ratings: r.ratings,
        wouldRecommend: r.wouldRecommend,
        at: r.submittedAt,
      })),
      await this.platformMeans(),
      now,
    );
    await this.doctors
      .updateOne(
        { _id: doctorId },
        summary
          ? { $set: { ratingSummary: { ...summary, updatedAt: now } } }
          : { $unset: { ratingSummary: 1 } },
      )
      .exec();
  }

  /** The platform-wide mean of each dimension over counted reviews; a fixed default until some exist. */
  private async platformMeans(): Promise<DimensionMeans> {
    const [row] = await this.reviews
      .aggregate<Record<string, number>>([
        { $match: { state: 'published', countsInSummary: true } },
        {
          $group: {
            _id: null,
            n: { $sum: 1 },
            ...Object.fromEntries(RATING_DIMENSIONS.map((d) => [d, { $avg: `$ratings.${d}` }])),
          },
        },
      ])
      .exec();
    if (!row || (row.n ?? 0) < 20) return DEFAULT_MEANS;
    return Object.fromEntries(
      RATING_DIMENSIONS.map((d) => [d, row[d] ?? DEFAULT_MEANS[d]]),
    ) as DimensionMeans;
  }
}
