import {
  DeleteAccountRequestSchema,
  ENDPOINTS,
  MyDataExportSchema,
  PUSH_SUBSCRIPTIONS_MAX,
  PushSubscriptionRequestSchema,
  PushSubscriptionResponseSchema,
  TransparencyResponseSchema,
  type MyReview,
  type ReportReason,
  type TransparencyMonth,
} from '@doqto/shared';
import { delay, http, HttpResponse } from 'msw';
import * as db from './db';
import { apiError, ok, parseBody, unauthenticated, url } from './respond';

/** Months before the current one, as example numbers; the current month is worked out from the mock reviews. */
const EARLIER: Array<Omit<TransparencyMonth, 'month'> & { ago: number }> = [
  {
    ago: 1,
    reviewsSubmitted: 212,
    reviewsPublished: 188,
    reviewsHeld: 14,
    reviewsRemoved: { abusive: 5, fake: 4, personal_info: 1 },
    appealsFiled: { doctor: 9, patient: 2 },
    appealsUpheld: { doctor: 3, patient: 1 },
  },
  {
    ago: 2,
    reviewsSubmitted: 174,
    reviewsPublished: 160,
    reviewsHeld: 8,
    reviewsRemoved: { abusive: 3, spam: 3 },
    appealsFiled: { doctor: 6, patient: 1 },
    appealsUpheld: { doctor: 2, patient: 0 },
  },
];

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

function transparencyMonths(now = new Date()): TransparencyMonth[] {
  const thisMonth = monthKey(now);
  const mine = db.allReviews().filter((r) => r.submittedAt.slice(0, 7) === thisMonth);
  const removed: Partial<Record<ReportReason, number>> = {};
  const current: TransparencyMonth = {
    month: thisMonth,
    reviewsSubmitted: mine.length,
    reviewsPublished: mine.filter((r) => r.state === 'published').length,
    reviewsHeld: mine.filter((r) => r.state === 'held_for_review').length,
    reviewsRemoved: removed,
    appealsFiled: { doctor: 0, patient: 0 },
    appealsUpheld: { doctor: 0, patient: 0 },
  };
  const earlier = EARLIER.map(({ ago, ...rest }) => ({
    ...rest,
    month: monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ago, 1))),
  }));
  return [current, ...earlier];
}

export const handlersAccount = [
  http.post(url(ENDPOINTS.myPushSubscriptions), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, PushSubscriptionRequestSchema);
    if (body.error) return body.error;
    await delay(250);
    const current = db.pushSubscriptionsOf(user.id);
    const same = current.find((x) => x.endpoint === body.data.endpoint);
    if (same) {
      return ok(PushSubscriptionResponseSchema, { id: same.id, count: current.length }, 201);
    }
    if (current.length >= PUSH_SUBSCRIPTIONS_MAX) {
      return apiError(409, 'CONFLICT', 'You have registered the most devices allowed');
    }
    const entry = { id: db.objectIdForMocks(), endpoint: body.data.endpoint };
    db.setPushSubscriptions(user.id, [...current, entry]);
    return ok(PushSubscriptionResponseSchema, { id: entry.id, count: current.length + 1 }, 201);
  }),

  http.delete(url('/me/push-subscriptions/:id'), async ({ params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const current = db.pushSubscriptionsOf(user.id);
    db.setPushSubscriptions(
      user.id,
      current.filter((x) => x.id !== String(params.id)),
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url(ENDPOINTS.myData), async () => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    await delay(400);
    const appointments = db
      .appointmentsOfUser(user.id)
      .map((a) => {
        const doctor = db.doctorById(a.doctorId);
        const clinic = db.clinicById(a.clinicId);
        if (!doctor || !clinic) return null;
        const { userId: _u, patientPhone: _p, visitCode: _c, ...appointment } = a;
        return {
          ...appointment,
          doctor: {
            id: doctor.id,
            name: doctor.name,
            slug: doctor.slug,
            specialties: doctor.specialties,
          },
          clinic: { id: clinic.id, name: clinic.name, area: clinic.address.area ?? null },
        };
      })
      .filter((x) => x !== null);
    const reviews: MyReview[] = db.allReviewsOf(user.id).map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      doctorId: r.doctorId,
      ratings: r.ratings,
      wouldRecommend: r.wouldRecommend,
      reason: r.reason,
      text: r.text,
      waitedMinutes: r.waitedMinutes,
      state: r.state,
      submittedAt: r.submittedAt,
      editedAt: r.editedAt,
      canEditUntil: null,
    }));
    return ok(MyDataExportSchema, {
      generatedAt: new Date().toISOString(),
      profile: user,
      appointments,
      reviews,
    });
  }),

  http.delete(url(ENDPOINTS.me), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, DeleteAccountRequestSchema);
    if (body.error) return body.error;
    await delay(500);
    db.deleteUser(user.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url(ENDPOINTS.transparency), async () => {
    await delay(200);
    return ok(TransparencyResponseSchema, {
      months: transparencyMonths(),
      updatedAt: new Date().toISOString(),
    });
  }),
];
