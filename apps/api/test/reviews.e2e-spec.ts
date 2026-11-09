import {
  ApiErrorSchema,
  DoctorReviewsPageSchema,
  MyReviewResponseSchema,
  ReviewEligibilityResponseSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { Appointment } from '../src/appointments/appointment.schema';
import { Clinic } from '../src/clinics/clinic.schema';
import { istDate } from '../src/common/time/ist';
import { Doctor } from '../src/doctors/doctor.schema';
import { Review } from '../src/reviews/review.schema';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { login, type Session } from './helpers';

const API = '/api/v1';
const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ratings = { waitTime: 4, explanation: 5, behaviour: 4, facilities: 3, valueForMoney: 4 };
const body = { ratings, wouldRecommend: 'yes', reason: 'checkup' } as const;
const GOOD_TEXT = 'The doctor explained everything clearly and the wait was short.';

describe('reviews: eligibility, submit, edit once, public list, reports (sprint 6)', () => {
  let app: INestApplication;
  let db: Connection;
  let appointments: Model<Appointment>;
  let reviews: Model<Review>;
  let doctors: Model<Doctor>;
  let clinicId: string;
  let doctorId: string;
  const http = () => request(app.getHttpServer());
  const as = (s: Session) => ({ Authorization: s.auth });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    appointments = app.get(getModelToken(Appointment.name));
    reviews = app.get(getModelToken(Review.name));
    doctors = app.get(getModelToken(Doctor.name));
    await seedDemo(
      {
        users: app.get(getModelToken(User.name)),
        doctors: doctors,
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      },
      { mode: 'demo' },
    );
    const clinic = await db.collection('clinics').findOne({ name: SEED.clinics[0].name });
    clinicId = clinic!._id.toHexString();
    const user = await db.collection('users').findOne({ phone: SEED.doctors[0].phone });
    doctorId = (await db.collection('doctors').findOne({ userId: user!._id }))!._id.toHexString();
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  /** A finished, verified visit that ended `endedAgoMs` ago. */
  async function visit(s: Session, endedAgoMs: number, extra: Record<string, unknown> = {}) {
    const ended = new Date(Date.now() - endedAgoMs);
    return appointments.create({
      doctorId: new Types.ObjectId(doctorId),
      clinicId: new Types.ObjectId(clinicId),
      patientUserId: new Types.ObjectId(s.user.id),
      patientName: 'Asha Devi',
      patientPhone: s.user.phone,
      date: istDate(ended),
      slotStart: new Date(ended.getTime() - 15 * 60_000),
      slotEnd: ended,
      source: 'online',
      status: 'completed',
      visitVerifiedAt: new Date(ended.getTime() - 20 * 60_000),
      consultEndAt: ended,
      reviewUnlockAt: new Date(ended.getTime() + DAY),
      bookingFee: 1500,
      statusHistory: [],
      ...extra,
    });
  }

  async function patient(name = 'Asha Devi') {
    const s = await login(app);
    await http().patch(`${API}/me`).set(as(s)).send({ name }).expect(200);
    return s;
  }

  it('lists finished visits as locked, open, expired or reviewed', async () => {
    const s = await patient();
    const locked = await visit(s, 2 * HOUR);
    const open = await visit(s, 3 * DAY);
    const expired = await visit(s, 40 * DAY);
    const res = ReviewEligibilityResponseSchema.parse(
      (await http().get(`${API}/reviews/eligibility`).set(as(s)).expect(200)).body,
    );
    const state = (id: string) => res.items.find((i) => i.appointmentId === id)?.state;
    expect(state(locked.id)).toBe('locked');
    expect(state(open.id)).toBe('open');
    expect(state(expired.id)).toBe('expired');
    expect(res.items[0]).toMatchObject({ clinicName: SEED.clinics[0].name });

    await http()
      .post(`${API}/reviews`)
      .set(as(s))
      .send({ appointmentId: open.id, ...body })
      .expect(201);
    const after = ReviewEligibilityResponseSchema.parse(
      (await http().get(`${API}/reviews/eligibility`).set(as(s)).expect(200)).body,
    );
    expect(after.items.find((i) => i.appointmentId === open.id)).toMatchObject({
      state: 'reviewed',
    });
    expect(after.items.find((i) => i.appointmentId === open.id)?.reviewId).toMatch(
      /^[a-f0-9]{24}$/,
    );
    await http().get(`${API}/reviews/eligibility`).expect(401);
  });

  describe('submit', () => {
    it('publishes a clean review, refuses a second one and a stranger', async () => {
      const s = await patient();
      const v = await visit(s, 2 * DAY);
      const created = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({ appointmentId: v.id, ...body, text: GOOD_TEXT, waitedMinutes: 20 })
            .expect(201)
        ).body,
      );
      expect(created.review).toMatchObject({
        appointmentId: v.id,
        doctorId,
        state: 'published',
        text: GOOD_TEXT,
        waitedMinutes: 20,
        editedAt: null,
      });
      expect(created.review.canEditUntil).not.toBeNull();

      const dup = await http()
        .post(`${API}/reviews`)
        .set(as(s))
        .send({ appointmentId: v.id, ...body })
        .expect(409);
      expect(code(dup.body)).toBe('CONFLICT');
      const stranger = await patient('Other Person');
      await http()
        .post(`${API}/reviews`)
        .set(as(stranger))
        .send({ appointmentId: v.id, ...body })
        .expect(404);
      await http().get(`${API}/reviews/mine/${v.id}`).set(as(stranger)).expect(404);
      const mine = MyReviewResponseSchema.parse(
        (await http().get(`${API}/reviews/mine/${v.id}`).set(as(s)).expect(200)).body,
      );
      expect(mine.review.id).toBe(created.review.id);
    });

    it('keeps the form shut until 24 hours after the visit, and after 30 days', async () => {
      const s = await patient();
      const soon = await visit(s, 2 * HOUR);
      const old = await visit(s, 45 * DAY);
      for (const v of [soon, old]) {
        const r = await http()
          .post(`${API}/reviews`)
          .set(as(s))
          .send({ appointmentId: v.id, ...body })
          .expect(403);
        expect(code(r.body)).toBe('FORBIDDEN');
      }
    });

    it('needs a finished, verified visit and valid input', async () => {
      const s = await patient();
      const unverified = await visit(s, 3 * DAY, { visitVerifiedAt: undefined });
      const upcoming = await visit(s, 3 * DAY, { status: 'confirmed' });
      for (const v of [unverified, upcoming]) {
        await http()
          .post(`${API}/reviews`)
          .set(as(s))
          .send({ appointmentId: v.id, ...body })
          .expect(403);
      }
      const ok = await visit(s, 3 * DAY);
      await http()
        .post(`${API}/reviews`)
        .set(as(s))
        .send({ appointmentId: ok.id, ...body, ratings: { ...ratings, waitTime: 9 } })
        .expect(400);
      await http()
        .post(`${API}/reviews`)
        .set(as(s))
        .send({ appointmentId: ok.id, ...body, text: 'short' })
        .expect(400);
    });

    it('holds a review that gives out a phone number, and the public never sees it', async () => {
      const s = await patient();
      const v = await visit(s, 3 * DAY);
      const r = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({
              appointmentId: v.id,
              ...body,
              text: 'Please call me on 98765 43210 about this doctor.',
            })
            .expect(201)
        ).body,
      );
      expect(r.review.state).toBe('held_for_review');
      const list = DoctorReviewsPageSchema.parse(
        (await http().get(`${API}/doctors/${doctorId}/reviews`).expect(200)).body,
      );
      expect(list.items.map((i) => i.id)).not.toContain(r.review.id);
    });
  });

  describe('edit once', () => {
    it('allows one edit within 7 days, then refuses', async () => {
      const s = await patient();
      const v = await visit(s, 3 * DAY);
      const made = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({ appointmentId: v.id, ...body })
            .expect(201)
        ).body,
      );
      const edited = MyReviewResponseSchema.parse(
        (
          await http()
            .patch(`${API}/reviews/${made.review.id}`)
            .set(as(s))
            .send({ ...body, wouldRecommend: 'no', text: GOOD_TEXT })
            .expect(200)
        ).body,
      );
      expect(edited.review).toMatchObject({ wouldRecommend: 'no', text: GOOD_TEXT });
      expect(edited.review.editedAt).not.toBeNull();
      expect(edited.review.canEditUntil).toBeNull();
      const again = await http()
        .patch(`${API}/reviews/${made.review.id}`)
        .set(as(s))
        .send(body)
        .expect(409);
      expect(code(again.body)).toBe('CONFLICT');

      // After 7 days even a first edit is closed.
      const t = await patient();
      const v2 = await visit(t, 3 * DAY);
      const old = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(t))
            .send({ appointmentId: v2.id, ...body })
            .expect(201)
        ).body,
      );
      await reviews.updateOne(
        { _id: old.review.id },
        { $set: { submittedAt: new Date(Date.now() - 8 * DAY) } },
      );
      await http().patch(`${API}/reviews/${old.review.id}`).set(as(t)).send(body).expect(409);
      // Someone else's review is a 404.
      await http().patch(`${API}/reviews/${made.review.id}`).set(as(t)).send(body).expect(404);
    });
  });

  describe('public list, summary and reports', () => {
    it('shows published reviews with a first name and initial, newest first, and fills the summary', async () => {
      const s = await patient('Meena Kumari');
      const v = await visit(s, 3 * DAY);
      await http()
        .post(`${API}/reviews`)
        .set(as(s))
        .send({ appointmentId: v.id, ...body, text: GOOD_TEXT })
        .expect(201);
      const list = DoctorReviewsPageSchema.parse(
        (await http().get(`${API}/doctors/${doctorId}/reviews`).query({ limit: 50 }).expect(200))
          .body,
      );
      expect(list.items.length).toBeGreaterThan(0);
      expect(list.items.find((i) => i.reviewerName === 'Meena K.')).toBeDefined();
      const dates = list.items.map((i) => Date.parse(i.publishedAt));
      expect([...dates].sort((a, b) => b - a)).toEqual(dates);

      const doctor = await doctors.findById(doctorId).lean();
      expect(doctor!.ratingSummary!.count).toBeGreaterThan(0);
      expect(doctor!.ratingSummary!.recommendPct).toBeGreaterThan(0);
      await http().get(`${API}/doctors/${new Types.ObjectId().toHexString()}/reviews`).expect(404);
    });

    it('marks an older review of the same doctor as an earlier visit and counts only the latest', async () => {
      const s = await patient('Kavita Rao');
      const first = await visit(s, 10 * DAY);
      const second = await visit(s, 3 * DAY);
      const a = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({ appointmentId: first.id, ...body })
            .expect(201)
        ).body,
      );
      await reviews.updateOne(
        { _id: a.review.id },
        { $set: { submittedAt: new Date(Date.now() - 9 * DAY) } },
      );
      const b = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({ appointmentId: second.id, ...body, wouldRecommend: 'no' })
            .expect(201)
        ).body,
      );
      const older = await reviews.findById(a.review.id).lean();
      const newer = await reviews.findById(b.review.id).lean();
      expect(String(older!.supersededBy)).toBe(b.review.id);
      expect(older!.countsInSummary).toBe(false);
      expect(newer!.countsInSummary).toBe(true);
      const list = DoctorReviewsPageSchema.parse(
        (await http().get(`${API}/doctors/${doctorId}/reviews`).query({ limit: 50 }).expect(200))
          .body,
      );
      expect(list.items.find((i) => i.id === a.review.id)?.earlierVisit).toBe(true);
      expect(list.items.find((i) => i.id === b.review.id)?.earlierVisit).toBe(false);
    });

    it('records a report once per person and refuses unknown reviews', async () => {
      const s = await patient();
      const v = await visit(s, 3 * DAY);
      const made = MyReviewResponseSchema.parse(
        (
          await http()
            .post(`${API}/reviews`)
            .set(as(s))
            .send({ appointmentId: v.id, ...body })
            .expect(201)
        ).body,
      );
      const reader = await patient('Reader');
      await http()
        .post(`${API}/reviews/${made.review.id}/report`)
        .set(as(reader))
        .send({ reason: 'spam' })
        .expect(204);
      await http()
        .post(`${API}/reviews/${made.review.id}/report`)
        .set(as(reader))
        .send({ reason: 'fake' })
        .expect(204);
      expect((await reviews.findById(made.review.id).lean())!.reports).toHaveLength(1);
      await http()
        .post(`${API}/reviews/${made.review.id}/report`)
        .set(as(reader))
        .send({ reason: 'rude' })
        .expect(400);
      await http()
        .post(`${API}/reviews/${new Types.ObjectId().toHexString()}/report`)
        .set(as(reader))
        .send({ reason: 'spam' })
        .expect(404);
    });
  });
});
