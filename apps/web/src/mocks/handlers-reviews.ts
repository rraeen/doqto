import {
  CreateReviewRequestSchema,
  DoctorReviewsPageSchema,
  DoctorReviewsQuerySchema,
  ENDPOINTS,
  MyReviewResponseSchema,
  ReportReviewRequestSchema,
  ReviewEligibilityResponseSchema,
  UpdateReviewRequestSchema,
  canEditReview,
  reviewWindow,
  reviewWindowState,
  reviewerDisplayName,
  REVIEW_EDIT_DAYS,
  type MyReview,
  type PublicReview,
  type ReviewEligibility,
} from '@doqto/shared';
import { delay, http, HttpResponse } from 'msw';
import { looksRisky } from '@/lib/demo-reviews';
import * as db from './db';
import { apiError, ok, parseBody, unauthenticated, url } from './respond';

function toMyReview(x: db.MockReview, now: number): MyReview {
  const editable = canEditReview({ submittedAt: x.submittedAt, editedAt: x.editedAt, now });
  return {
    id: x.id,
    appointmentId: x.appointmentId,
    doctorId: x.doctorId,
    ratings: x.ratings,
    wouldRecommend: x.wouldRecommend,
    reason: x.reason,
    text: x.text,
    waitedMinutes: x.waitedMinutes,
    state: x.state,
    submittedAt: x.submittedAt,
    editedAt: x.editedAt,
    canEditUntil: editable
      ? new Date(Date.parse(x.submittedAt) + REVIEW_EDIT_DAYS * 86_400_000).toISOString()
      : null,
  };
}

function toPublic(x: db.MockReview, newestByUser: Map<string, string>): PublicReview {
  return {
    id: x.id,
    reviewerName: x.reviewerName,
    ratings: x.ratings,
    wouldRecommend: x.wouldRecommend,
    reason: x.reason,
    text: x.text,
    visitMonth: x.visitMonth,
    earlierVisit: newestByUser.get(x.userId) !== x.id,
    reply: x.reply,
    publishedAt: x.publishedAt ?? x.submittedAt,
  };
}

export const handlersReviews = [
  http.get(url(ENDPOINTS.reviews.eligibility), async () => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    db.ensurePastVisits(user.id);
    await delay(250);
    const now = Date.now();
    const items: ReviewEligibility[] = [];
    for (const a of db.appointmentsOfUser(user.id)) {
      if (a.status !== 'completed' || !a.slotEnd) continue;
      const doctor = db.doctorById(a.doctorId);
      const clinic = db.clinicById(a.clinicId);
      if (!doctor || !clinic) continue;
      const existing = db.reviewForAppointment(a.id);
      const window = reviewWindow(a.slotEnd);
      items.push({
        appointmentId: a.id,
        doctor: { id: doctor.id, name: doctor.name, slug: doctor.slug },
        clinicName: clinic.name,
        visitEndedAt: a.slotEnd,
        state: existing ? 'reviewed' : reviewWindowState(a.slotEnd, now),
        unlocksAt: window.unlocksAt,
        closesAt: window.closesAt,
        reviewId: existing?.id ?? null,
      });
    }
    items.sort((x, y) => Date.parse(y.visitEndedAt) - Date.parse(x.visitEndedAt));
    return ok(ReviewEligibilityResponseSchema, { items });
  }),

  http.post(url(ENDPOINTS.reviews.create), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, CreateReviewRequestSchema);
    if (body.error) return body.error;
    const appt = db.appointmentById(body.data.appointmentId);
    if (!appt || appt.userId !== user.id) return apiError(404, 'NOT_FOUND', 'Visit not found');
    await delay(500);
    if (appt.status !== 'completed' || !appt.slotEnd) {
      return apiError(403, 'FORBIDDEN', 'Only a finished visit can be reviewed');
    }
    if (db.reviewForAppointment(appt.id)) {
      return apiError(409, 'CONFLICT', 'You already reviewed this visit');
    }
    const now = Date.now();
    const window = reviewWindowState(appt.slotEnd, now);
    if (window !== 'open') {
      return apiError(
        403,
        'FORBIDDEN',
        window === 'locked' ? 'The review form is not open yet' : 'The review window has closed',
      );
    }
    const iso = new Date(now).toISOString();
    const held = looksRisky(body.data.text);
    const review: db.MockReview = {
      id: db.objectIdForMocks(),
      appointmentId: appt.id,
      doctorId: appt.doctorId,
      userId: user.id,
      reviewerName: reviewerDisplayName(user.name),
      ratings: body.data.ratings,
      wouldRecommend: body.data.wouldRecommend,
      reason: body.data.reason,
      text: body.data.text ?? null,
      waitedMinutes: body.data.waitedMinutes ?? null,
      state: held ? 'held_for_review' : 'published',
      submittedAt: iso,
      editedAt: null,
      publishedAt: held ? null : iso,
      visitMonth: new Date(appt.slotEnd).toISOString().slice(0, 7),
      reply: null,
      reports: 0,
    };
    db.putReview(review);
    return ok(MyReviewResponseSchema, { review: toMyReview(review, now) }, 201);
  }),

  http.patch(url('/reviews/:id'), async ({ request, params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, UpdateReviewRequestSchema);
    if (body.error) return body.error;
    const existing = db.reviewById(String(params.id));
    if (!existing || existing.userId !== user.id) {
      return apiError(404, 'NOT_FOUND', 'Review not found');
    }
    await delay(400);
    const now = Date.now();
    if (!canEditReview({ submittedAt: existing.submittedAt, editedAt: existing.editedAt, now })) {
      return apiError(409, 'CONFLICT', 'This review can no longer be edited');
    }
    const held = looksRisky(body.data.text);
    const updated: db.MockReview = {
      ...existing,
      ratings: body.data.ratings,
      wouldRecommend: body.data.wouldRecommend,
      reason: body.data.reason,
      text: body.data.text ?? null,
      waitedMinutes: body.data.waitedMinutes ?? null,
      editedAt: new Date(now).toISOString(),
      state: held ? 'held_for_review' : 'published',
      publishedAt: held ? null : (existing.publishedAt ?? new Date(now).toISOString()),
    };
    db.putReview(updated);
    return ok(MyReviewResponseSchema, { review: toMyReview(updated, now) });
  }),

  http.get(url(ENDPOINTS.reviews.mine(':appointmentId')), async ({ params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const existing = db.reviewForAppointment(String(params.appointmentId));
    if (!existing || existing.userId !== user.id) {
      return apiError(404, 'NOT_FOUND', 'No review for this visit');
    }
    await delay(150);
    return ok(MyReviewResponseSchema, { review: toMyReview(existing, Date.now()) });
  }),

  http.get(url('/doctors/:id/reviews'), async ({ request, params }) => {
    const query = DoctorReviewsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return apiError(400, 'VALIDATION_FAILED', 'Validation failed');
    }
    const doctorId = String(params.id);
    if (!db.doctorById(doctorId)) return apiError(404, 'NOT_FOUND', 'Doctor not found');
    await delay(250);
    const all = db.publicReviewsOf(doctorId);
    const newestByUser = new Map<string, string>();
    for (const x of all) if (!newestByUser.has(x.userId)) newestByUser.set(x.userId, x.id);
    const offset = Number(query.data.cursor ?? 0) || 0;
    const slice = all.slice(offset, offset + query.data.limit);
    const next = offset + slice.length;
    return ok(DoctorReviewsPageSchema, {
      items: slice.map((x) => toPublic(x, newestByUser)),
      nextCursor: next < all.length ? String(next) : null,
    });
  }),

  http.post(url('/reviews/:id/report'), async ({ request, params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, ReportReviewRequestSchema);
    if (body.error) return body.error;
    const existing = db.reviewById(String(params.id));
    if (!existing) return apiError(404, 'NOT_FOUND', 'Review not found');
    db.putReview({ ...existing, reports: existing.reports + 1 });
    return new HttpResponse(null, { status: 204 });
  }),
];
