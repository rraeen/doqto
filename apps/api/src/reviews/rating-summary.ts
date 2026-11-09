import { RATING_DIMENSIONS, type RatingDimension, type ReviewRatings } from '@doqto/shared';

/** TDD 5.4: `score = (C*m + sum(r_i * w_i)) / (C + sum(w_i))`, C = 10, w halves every 12 months. */
export const BAYES_C = 10;
const HALF_LIFE_MS = 365 * 86_400_000;
/** The platform mean used until there are reviews to take one from. */
export const DEFAULT_MEAN = 3.5;

export interface CountedReview {
  ratings: ReviewRatings;
  wouldRecommend: 'yes' | 'no' | 'unsure';
  /** The visit or submission time, for the recency weight. */
  at: Date;
}

export type DimensionMeans = Record<RatingDimension, number>;
export const DEFAULT_MEANS: DimensionMeans = {
  waitTime: DEFAULT_MEAN,
  explanation: DEFAULT_MEAN,
  behaviour: DEFAULT_MEAN,
  facilities: DEFAULT_MEAN,
  valueForMoney: DEFAULT_MEAN,
};

const weight = (at: Date, now: Date) =>
  0.5 ** (Math.max(0, now.getTime() - at.getTime()) / HALF_LIFE_MS);

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export interface SummaryValues {
  count: number;
  recommendPct: number;
  waitTime: number;
  explanation: number;
  behaviour: number;
  facilities: number;
  valueForMoney: number;
}

/**
 * The doctor's rating summary from the reviews that count. A doctor with few reviews is pulled
 * towards the platform mean `means`, so three 5-star reviews never read as 5.0. `null` when no
 * review counts yet. Showing the summary is a display rule elsewhere (5 or more counted reviews).
 */
export function summarise(
  reviews: readonly CountedReview[],
  means: DimensionMeans = DEFAULT_MEANS,
  now = new Date(),
): SummaryValues | null {
  if (reviews.length === 0) return null;
  const weights = reviews.map((r) => weight(r.at, now));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const dimension = (key: RatingDimension) => {
    const sum = reviews.reduce((acc, r, i) => acc + r.ratings[key] * (weights[i] as number), 0);
    return round((BAYES_C * means[key] + sum) / (BAYES_C + totalWeight), 2);
  };
  const yes = reviews.filter((r) => r.wouldRecommend === 'yes').length;
  const values = Object.fromEntries(
    RATING_DIMENSIONS.map((d) => [d, dimension(d)]),
  ) as DimensionMeans;
  return {
    count: reviews.length,
    recommendPct: round((yes / reviews.length) * 100, 0),
    ...values,
  };
}
