import {
  CONTRACT_VERSION,
  CreateReviewRequestSchema,
  ENDPOINTS,
  ReportReviewRequestSchema,
  canEditReview,
  reviewWindow,
  reviewWindowState,
  reviewerDisplayName,
} from './index';

const id = 'a'.repeat(24);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ratings = { waitTime: 4, explanation: 5, behaviour: 5, facilities: 4, valueForMoney: 5 };
const base = {
  appointmentId: id,
  ratings,
  wouldRecommend: 'yes',
  reason: 'checkup',
};

describe('contract v4 (reviews)', () => {
  it('is version 4 or later', () => expect(CONTRACT_VERSION).toMatch(/^[4-9]\./));

  it('exposes the review endpoints', () => {
    expect(ENDPOINTS.reviews.eligibility).toBe('/reviews/eligibility');
    expect(ENDPOINTS.reviews.create).toBe('/reviews');
    expect(ENDPOINTS.reviews.report(id)).toBe(`/reviews/${id}/report`);
    expect(ENDPOINTS.doctors.reviews(id)).toBe(`/doctors/${id}/reviews`);
  });

  it('a review needs five ratings from 1 to 5, a recommendation and a reason', () => {
    expect(CreateReviewRequestSchema.safeParse(base).success).toBe(true);
    const bad = (extra: object) =>
      CreateReviewRequestSchema.safeParse({ ...base, ...extra }).success;
    expect(bad({ ratings: { ...ratings, waitTime: 0 } })).toBe(false);
    expect(bad({ ratings: { ...ratings, waitTime: 6 } })).toBe(false);
    expect(bad({ ratings: { ...ratings, waitTime: 3.5 } })).toBe(false);
    expect(bad({ ratings: { waitTime: 5 } })).toBe(false);
    expect(bad({ wouldRecommend: 'maybe' })).toBe(false);
    expect(bad({ reason: 'chest pain and fever' })).toBe(false);
  });

  it('text is optional but 20 to 1000 characters when given; wait is 0 to 600 minutes', () => {
    const bad = (extra: object) =>
      CreateReviewRequestSchema.safeParse({ ...base, ...extra }).success;
    expect(bad({ text: 'Too short' })).toBe(false);
    expect(bad({ text: 'The doctor explained everything clearly.' })).toBe(true);
    expect(bad({ text: 'x'.repeat(1001) })).toBe(false);
    expect(bad({ waitedMinutes: 45 })).toBe(true);
    expect(bad({ waitedMinutes: -1 })).toBe(false);
    expect(bad({ waitedMinutes: 601 })).toBe(false);
  });

  it('refuses extra fields (nothing clinical can ride along)', () => {
    expect(CreateReviewRequestSchema.safeParse({ ...base, diagnosis: 'flu' }).success).toBe(false);
  });

  it('report takes a reason from a fixed list', () => {
    expect(ReportReviewRequestSchema.safeParse({ reason: 'fake' }).success).toBe(true);
    expect(ReportReviewRequestSchema.safeParse({ reason: 'I dislike it' }).success).toBe(false);
  });
});

describe('review window (TDD 5.2)', () => {
  const ended = '2026-10-10T08:00:00.000Z';
  const t0 = Date.parse(ended);

  it('opens 24 hours after the visit and stays open 30 days', () => {
    const w = reviewWindow(ended);
    expect(Date.parse(w.unlocksAt) - t0).toBe(24 * HOUR);
    expect(Date.parse(w.closesAt) - Date.parse(w.unlocksAt)).toBe(30 * DAY);
  });

  it('is locked, then open, then expired', () => {
    expect(reviewWindowState(ended, t0 + 23 * HOUR)).toBe('locked');
    expect(reviewWindowState(ended, t0 + 24 * HOUR)).toBe('open');
    expect(reviewWindowState(ended, t0 + 24 * HOUR + 30 * DAY)).toBe('open');
    expect(reviewWindowState(ended, t0 + 24 * HOUR + 30 * DAY + 1)).toBe('expired');
  });
});

describe('editing a review', () => {
  const submittedAt = '2026-10-10T08:00:00.000Z';
  const t0 = Date.parse(submittedAt);

  it('is allowed once, within 7 days', () => {
    expect(canEditReview({ submittedAt, editedAt: null, now: t0 + 6 * DAY })).toBe(true);
    expect(canEditReview({ submittedAt, editedAt: null, now: t0 + 7 * DAY })).toBe(true);
    expect(canEditReview({ submittedAt, editedAt: null, now: t0 + 7 * DAY + 1 })).toBe(false);
    expect(canEditReview({ submittedAt, editedAt: submittedAt, now: t0 + DAY })).toBe(false);
  });
});

describe('reviewerDisplayName', () => {
  it('shows first name and last initial', () => {
    expect(reviewerDisplayName('Asha Devi')).toBe('Asha D.');
    expect(reviewerDisplayName('  ravi  kumar  singh ')).toBe('ravi S.');
    expect(reviewerDisplayName('Meera')).toBe('Meera');
    expect(reviewerDisplayName(null)).toBe('Patient');
    expect(reviewerDisplayName('')).toBe('Patient');
  });
});
