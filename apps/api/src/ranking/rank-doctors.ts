/**
 * Search ranking (BE-10, TDD 5.8). One pure function. Its input type has no payment field and
 * this folder may not import payments (lint rule doqto/no-payments-in-trust-code), so paying
 * Doqto can never move a doctor up the list.
 */
export interface RankingInput {
  /** `null` when the search had no `near`. */
  distanceKm: number | null;
  /** The doctor lists the searched specialty (true when no specialty filter). */
  specialtyMatch: boolean;
  /** 0 to 1: share of the next days with free slots. 0 until slots exist (sprint 5). */
  availability: number;
  /** Bayesian rating 1 to 5 from ratingSummary, or `null` when "New on Doqto". */
  score: number | null;
  /** Counted reviews. */
  reviewCount: number;
}

export const RANKING_WEIGHTS = {
  distance: 0.35,
  specialty: 0.25,
  availability: 0.15,
  score: 0.2,
  reviews: 0.05,
} as const;

/** Distance where the distance component reaches half its value. */
const DISTANCE_HALF_KM = 5;
/** Neutral score for doctors without enough reviews, so new doctors are not buried. */
const NEUTRAL_SCORE = 3.5;

/** Higher is better. Deterministic, bounded to [0, 1]. */
export function rankScore(input: RankingInput): number {
  const w = RANKING_WEIGHTS;
  const distance =
    input.distanceKm === null ? 0.5 : 1 / (1 + Math.max(0, input.distanceKm) / DISTANCE_HALF_KM);
  const specialty = input.specialtyMatch ? 1 : 0;
  const availability = Math.min(1, Math.max(0, input.availability));
  const score = ((input.score ?? NEUTRAL_SCORE) - 1) / 4;
  const reviews = Math.min(1, Math.log10(1 + Math.max(0, input.reviewCount)) / 2);
  const total =
    w.distance * distance +
    w.specialty * specialty +
    w.availability * availability +
    w.score * score +
    w.reviews * reviews;
  return Math.round(total * 1e6) / 1e6;
}

/** Sorts by rank (desc), then by id for a stable order across pages. */
export function rankDoctors<T extends { id: string; input: RankingInput }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => rankScore(b.input) - rankScore(a.input) || a.id.localeCompare(b.id),
  );
}
