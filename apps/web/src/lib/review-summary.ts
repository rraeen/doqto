import { RATING_DIMENSIONS, type PublicReview, type RatingSummary } from '@doqto/shared';

/** A doctor needs this many counted reviews before scores show ("New on Doqto" until then). */
export const MIN_REVIEWS_FOR_SCORES = 5;

/**
 * Scores worked out from a list of reviews, for demo mode where there is no server job. Only a
 * patient's most recent review counts, so earlier visits are skipped. Returns `null` under 5.
 */
export function summarise(
  reviews: readonly PublicReview[],
  now = Date.now(),
): RatingSummary | null {
  const counted = reviews.filter((r) => !r.earlierVisit);
  if (counted.length < MIN_REVIEWS_FOR_SCORES) return null;
  const mean = (pick: (r: PublicReview) => number) =>
    Math.round((counted.reduce((n, r) => n + pick(r), 0) / counted.length) * 10) / 10;
  const dims = Object.fromEntries(
    RATING_DIMENSIONS.map((d) => [d, mean((r) => r.ratings[d])]),
  ) as Record<(typeof RATING_DIMENSIONS)[number], number>;
  const yes = counted.filter((r) => r.wouldRecommend === 'yes').length;
  return {
    count: counted.length,
    recommendPct: Math.round((yes / counted.length) * 100),
    ...dims,
    updatedAt: new Date(now).toISOString(),
  };
}
