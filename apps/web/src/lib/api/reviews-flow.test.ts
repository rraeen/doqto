import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockConfig, resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import { requestOtp, updateMe, verifyOtp } from './auth';
import { searchDoctors } from './doctors';
import { ApiError } from './errors';
import {
  createReview,
  getDoctorReviews,
  getMyReview,
  getReviewEligibility,
  reportReview,
  updateReview,
} from './reviews';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetMockDb();
  mockConfig.seedPastVisits = true;
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  mockConfig.seedPastVisits = true;
  server.close();
});

async function signIn(phone: string, name?: string) {
  await requestOtp(phone);
  await verifyOtp({ phone, code: '123456' });
  if (name) await updateMe({ name });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return (err as ApiError).code;
}

const ratings = { waitTime: 4, explanation: 5, behaviour: 5, facilities: 4, valueForMoney: 5 };
const good = {
  ratings,
  wouldRecommend: 'yes',
  reason: 'checkup',
  text: 'The doctor explained everything clearly and kindly.',
} as const;

const find = async (state: string) => {
  const item = (await getReviewEligibility()).find((x) => x.state === state);
  if (!item) throw new Error(`no ${state} visit`);
  return item;
};

describe('reviews against the contract mocks', { timeout: 30_000 }, () => {
  it('lists finished visits as open, locked and closed', async () => {
    await signIn('+919811200001', 'Asha Devi');
    const items = await getReviewEligibility();
    expect(items.map((x) => x.state).sort()).toEqual(['expired', 'locked', 'open']);
    const locked = items.find((x) => x.state === 'locked')!;
    // Opens 24 hours after the visit ended.
    expect(Date.parse(locked.unlocksAt) - Date.parse(locked.visitEndedAt)).toBe(24 * 3_600_000);
  });

  it('publishes a review of an open visit, once, under first name and last initial', async () => {
    await signIn('+919811200002', 'Asha Devi');
    const open = await find('open');
    const before = await getDoctorReviews(open.doctor.id);

    const review = await createReview({ appointmentId: open.appointmentId, ...good });
    expect(review.state).toBe('published');
    expect(review.canEditUntil).not.toBeNull();
    expect((await find('reviewed')).reviewId).toBe(review.id);

    const after = await getDoctorReviews(open.doctor.id);
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(after.items[0]).toMatchObject({ reviewerName: 'Asha D.', earlierVisit: false });

    expect(await codeOf(createReview({ appointmentId: open.appointmentId, ...good }))).toBe(
      'CONFLICT',
    );
    expect((await getMyReview(open.appointmentId))?.id).toBe(review.id);
  });

  it('refuses a locked or closed visit, and visits of other people', async () => {
    await signIn('+919811200003', 'Ravi Kumar');
    const locked = await find('locked');
    const expired = await find('expired');
    expect(await codeOf(createReview({ appointmentId: locked.appointmentId, ...good }))).toBe(
      'FORBIDDEN',
    );
    expect(await codeOf(createReview({ appointmentId: expired.appointmentId, ...good }))).toBe(
      'FORBIDDEN',
    );
    const open = await find('open');
    await signIn('+919811200004', 'Meera Joshi');
    expect(await codeOf(createReview({ appointmentId: open.appointmentId, ...good }))).toBe(
      'NOT_FOUND',
    );
  });

  it('holds a review that hands out a phone number, and keeps it off the public list', async () => {
    await signIn('+919811200005', 'Asha Devi');
    const open = await find('open');
    const before = await getDoctorReviews(open.doctor.id);
    const review = await createReview({
      appointmentId: open.appointmentId,
      ...good,
      text: 'Great doctor, call me on 98765 43210 for details.',
    });
    expect(review.state).toBe('held_for_review');
    expect((await getDoctorReviews(open.doctor.id)).items).toHaveLength(before.items.length);
  });

  it('lets the patient edit once, then refuses', async () => {
    await signIn('+919811200006', 'Asha Devi');
    const open = await find('open');
    const review = await createReview({ appointmentId: open.appointmentId, ...good });
    const edited = await updateReview(review.id, {
      ratings: { ...ratings, waitTime: 2 },
      wouldRecommend: 'unsure',
      reason: 'follow_up',
      text: 'After thinking again, the wait was too long for me.',
    });
    expect(edited.ratings.waitTime).toBe(2);
    expect(edited.editedAt).not.toBeNull();
    expect(edited.canEditUntil).toBeNull();
    expect(
      await codeOf(updateReview(review.id, { ratings, wouldRecommend: 'yes', reason: 'checkup' })),
    ).toBe('CONFLICT');
  });

  it('takes a report from a signed-in patient', async () => {
    await signIn('+919811200007', 'Asha Devi');
    const { id: doctorId } = (await find('open')).doctor;
    const first = (await getDoctorReviews(doctorId)).items[0]!;
    await expect(reportReview(first.id, 'abusive')).resolves.toBeUndefined();
  });

  it('shows a rating summary only once a doctor has 5 counted reviews', async () => {
    await signIn('+919811200008', 'Asha Devi');
    const found = await searchDoctors({ city: 'Bareilly' });
    const anita = found.items.find((d) => d.slug === 'dr-anita-sharma-bareilly')!;
    expect(anita.ratingSummary?.count).toBeGreaterThanOrEqual(5);
    expect(anita.ratingSummary?.recommendPct).toBeGreaterThan(0);
    const other = found.items.find((d) => d.slug !== 'dr-anita-sharma-bareilly')!;
    expect(other.ratingSummary).toBeNull();
  });
});
