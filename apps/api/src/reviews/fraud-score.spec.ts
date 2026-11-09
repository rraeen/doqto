import {
  maxSimilarity,
  scoreReview,
  trigramSimilarity,
  verdictFor,
  type ScoreInput,
} from './fraud-score';
import { DEFAULT_MEANS, summarise } from './rating-summary';

const clean: ScoreInput = {
  ratings: { waitTime: 4, explanation: 5, behaviour: 4, facilities: 3, valueForMoney: 4 },
  text: 'The doctor explained everything clearly and the wait was short.',
  accountAgeDaysAtVisit: 200,
  firstSeenAsWalkInHere: false,
  recentReviews: 1,
  dailyAverage30d: 0.2,
  maxSimilarity: 0.1,
  otherOneStarSameSpecialtyCity: 0,
};

describe('review scoring (TDD 5.5)', () => {
  it('scores an ordinary review 0 and publishes it counting', () => {
    const r = scoreReview(clean);
    expect(r).toEqual({ score: 0, signals: [] });
    expect(verdictFor(r.score)).toEqual({ state: 'published', countsInSummary: true });
  });

  it('adds points per signal', () => {
    expect(scoreReview({ ...clean, firstSeenAsWalkInHere: true }).score).toBe(20);
    expect(scoreReview({ ...clean, accountAgeDaysAtVisit: 2 }).score).toBe(15);
    expect(scoreReview({ ...clean, maxSimilarity: 0.9 }).score).toBe(25);
    const lowEffort = scoreReview({
      ...clean,
      text: 'great',
      ratings: { waitTime: 5, explanation: 5, behaviour: 5, facilities: 5, valueForMoney: 5 },
    });
    expect(lowEffort.signals).toEqual(['uniform_low_effort']);
    expect(scoreReview({ ...clean, recentReviews: 8, dailyAverage30d: 0.1 }).signals).toContain(
      'review_burst',
    );
  });

  it('bands: under 40 counts, 40 to 69 shows but weighs nothing, 70 and over is held', () => {
    expect(verdictFor(39)).toEqual({ state: 'published', countsInSummary: true });
    expect(verdictFor(40)).toEqual({ state: 'published', countsInSummary: false });
    expect(verdictFor(69)).toEqual({ state: 'published', countsInSummary: false });
    expect(verdictFor(70)).toEqual({ state: 'held_for_review', countsInSummary: false });
  });

  it('holds a review that carries a phone number or a link', () => {
    const phone = scoreReview({ ...clean, text: 'Call me on 98765 43210 for details please' });
    expect(phone.signals).toContain('contact_details');
    expect(verdictFor(phone.score).state).toBe('held_for_review');
    expect(
      verdictFor(scoreReview({ ...clean, text: 'see https://example.com now ok fine' }).score)
        .state,
    ).toBe('held_for_review');
  });

  it('measures text similarity', () => {
    expect(trigramSimilarity('the same words here', 'the same words here')).toBe(1);
    expect(trigramSimilarity('abc abc abc', 'xyz xyz xyz')).toBe(0);
    expect(maxSimilarity('short', ['short'])).toBe(0);
    expect(
      maxSimilarity('The doctor was very kind and explained everything', [
        'Parking is difficult here',
        'The doctor was very kind and explained everything',
      ]),
    ).toBe(1);
  });
});

describe('rating summary (TDD 5.4)', () => {
  const at = new Date('2026-10-01T00:00:00Z');
  const five = { waitTime: 5, explanation: 5, behaviour: 5, facilities: 5, valueForMoney: 5 };
  const one = { waitTime: 1, explanation: 1, behaviour: 1, facilities: 1, valueForMoney: 1 };

  it('is null with no counted reviews', () => {
    expect(summarise([], DEFAULT_MEANS, at)).toBeNull();
  });

  it('pulls a few reviews towards the platform mean, so three 5-star reviews are not 5.0', () => {
    const s = summarise(
      Array.from({ length: 3 }, () => ({ ratings: five, wouldRecommend: 'yes' as const, at })),
      DEFAULT_MEANS,
      at,
    )!;
    expect(s.count).toBe(3);
    expect(s.waitTime).toBeGreaterThan(3.5);
    expect(s.waitTime).toBeLessThan(4.5);
    expect(s.recommendPct).toBe(100);
  });

  it('approaches the real average with many reviews, and old ones weigh less', () => {
    const many = Array.from({ length: 200 }, () => ({
      ratings: five,
      wouldRecommend: 'yes' as const,
      at,
    }));
    expect(summarise(many, DEFAULT_MEANS, at)!.behaviour).toBeGreaterThan(4.9);
    const now = new Date('2027-10-01T00:00:00Z');
    const mixed = [
      { ratings: one, wouldRecommend: 'no' as const, at: new Date('2025-10-01T00:00:00Z') },
      { ratings: five, wouldRecommend: 'yes' as const, at: new Date('2027-09-30T00:00:00Z') },
    ];
    // The 2-year-old 1-star review weighs a quarter as much, so the score is higher than if both were recent.
    const s = summarise(mixed, DEFAULT_MEANS, now)!;
    const bothRecent = summarise(
      mixed.map((m) => ({ ...m, at: new Date('2027-09-30T00:00:00Z') })),
      DEFAULT_MEANS,
      now,
    )!;
    expect(s.waitTime).toBeGreaterThan(bothRecent.waitTime);
    expect(s.recommendPct).toBe(50);
  });
});
