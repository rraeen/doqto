import type { ReviewRatings } from '@doqto/shared';

/**
 * Rule-based review scoring (TDD 5.5). No machine learning: every signal adds fixed points.
 * Under 40 the review is published and counts; 40 to 69 it is published but counts for nothing
 * until an admin clears it; 70 and over it is held and not shown. Nothing here looks at who a
 * doctor is or whether they pay (TDD 5.8): the inputs are the review, the reviewer and the
 * doctor's recent review activity.
 */
export const FRAUD_PUBLISH_BELOW = 40;
export const FRAUD_HOLD_FROM = 70;

export interface ScoreInput {
  ratings: ReviewRatings;
  text?: string | null;
  /** Days between the reviewer's account creation and the visit; small means a throwaway account. */
  accountAgeDaysAtVisit: number;
  /** The reviewer's phone was first seen as a walk-in entered at this same clinic. */
  firstSeenAsWalkInHere: boolean;
  /** Reviews the doctor got in the last 48 hours (including this one) and their 30-day daily mean. */
  recentReviews: number;
  dailyAverage30d: number;
  /** Highest trigram similarity (0 to 1) to this doctor's last 200 reviews. */
  maxSimilarity: number;
  /** Other reviews by this patient with all five ratings at 1, same specialty and city. */
  otherOneStarSameSpecialtyCity: number;
}

export interface ScoreResult {
  score: number;
  signals: string[];
}

const dims = (r: ReviewRatings) => [
  r.waitTime,
  r.explanation,
  r.behaviour,
  r.facilities,
  r.valueForMoney,
];

/** A link or a long digit run (a phone number) in the text: personal details do not go public. */
export function hasContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  return /https?:\/\/|www\./i.test(text) || /\d{8,}/.test(text.replace(/[\s-]/g, ''));
}

export function scoreReview(i: ScoreInput): ScoreResult {
  const signals: string[] = [];
  let score = 0;
  const add = (points: number, name: string) => {
    score += points;
    signals.push(name);
  };

  if (i.firstSeenAsWalkInHere) add(20, 'walk_in_phone_first_seen_here');
  if (i.accountAgeDaysAtVisit < 7) add(15, 'new_account');
  // Over 3 times the 30-day daily mean within 48 hours; a quiet doctor needs at least 3 reviews.
  if (i.recentReviews >= 3 && i.recentReviews > 3 * Math.max(i.dailyAverage30d * 2, 0.5)) {
    add(20, 'review_burst');
  }
  if (i.maxSimilarity > 0.7) add(25, 'similar_text');
  const d = dims(i.ratings);
  const uniform = d.every((x) => x === d[0]) && (d[0] === 5 || d[0] === 1);
  if (uniform && (i.text?.length ?? 0) < 40) add(10, 'uniform_low_effort');
  if (i.otherOneStarSameSpecialtyCity >= 2 && uniform && d[0] === 1) add(20, 'repeat_one_star');
  if (hasContactDetails(i.text)) add(FRAUD_HOLD_FROM, 'contact_details');
  return { score, signals };
}

export type ReviewVerdict = { state: 'published' | 'held_for_review'; countsInSummary: boolean };

export function verdictFor(score: number): ReviewVerdict {
  if (score >= FRAUD_HOLD_FROM) return { state: 'held_for_review', countsInSummary: false };
  return { state: 'published', countsInSummary: score < FRAUD_PUBLISH_BELOW };
}

// ---------------------------------------------------------------- text similarity

const trigrams = (text: string): Set<string> => {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
};

/** Jaccard similarity of character trigrams: 1 is identical, 0 has nothing in common. */
export function trigramSimilarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const g of x) if (y.has(g)) shared++;
  return shared / (x.size + y.size - shared);
}

export function maxSimilarity(text: string | null | undefined, others: readonly string[]): number {
  if (!text || text.length < 20) return 0;
  return others.reduce((m, o) => Math.max(m, trigramSimilarity(text, o)), 0);
}
