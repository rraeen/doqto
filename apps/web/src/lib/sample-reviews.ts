import type { PublicReview, ReviewRatings, VisitReason, WouldRecommend } from '@doqto/shared';

/** The slug of the doctor the demo's example reviews belong to. */
export const SAMPLE_REVIEWED_SLUG = 'dr-anita-sharma-bareilly';
const DAY = 86_400_000;

export interface SampleReviewData {
  reviewerName: string;
  ratings: ReviewRatings;
  wouldRecommend: WouldRecommend;
  reason: VisitReason;
  text: string | null;
  daysAgo: number;
  reply?: string;
}

/** Example reviews for one demo doctor, so the profile shows bars and a list. Not real reviews. */
export const SAMPLE_REVIEW_DATA: SampleReviewData[] = [
  {
    reviewerName: 'Sunita R.',
    ratings: { waitTime: 4, explanation: 5, behaviour: 5, facilities: 4, valueForMoney: 5 },
    wouldRecommend: 'yes',
    reason: 'checkup',
    text: 'The doctor listened patiently and explained everything in simple words.',
    daysAgo: 12,
    reply: 'Thank you for your kind words. Wishing you good health.',
  },
  {
    reviewerName: 'Mohit K.',
    ratings: { waitTime: 3, explanation: 5, behaviour: 4, facilities: 4, valueForMoney: 4 },
    wouldRecommend: 'yes',
    reason: 'follow_up',
    text: 'A short wait but worth it. Clear advice for the follow-up.',
    daysAgo: 25,
  },
  {
    reviewerName: 'Farah A.',
    ratings: { waitTime: 5, explanation: 4, behaviour: 5, facilities: 5, valueForMoney: 5 },
    wouldRecommend: 'yes',
    reason: 'child',
    text: null,
    daysAgo: 41,
  },
  {
    reviewerName: 'Deepak S.',
    ratings: { waitTime: 2, explanation: 4, behaviour: 4, facilities: 3, valueForMoney: 4 },
    wouldRecommend: 'unsure',
    reason: 'checkup',
    text: 'Waited almost an hour past my slot, but the consultation itself was good.',
    daysAgo: 63,
  },
  {
    reviewerName: 'Neha G.',
    ratings: { waitTime: 4, explanation: 5, behaviour: 5, facilities: 4, valueForMoney: 4 },
    wouldRecommend: 'yes',
    reason: 'women',
    text: 'Very respectful and thorough. The clinic is clean and well organised.',
    daysAgo: 90,
  },
  {
    reviewerName: 'Imran Q.',
    ratings: { waitTime: 4, explanation: 4, behaviour: 5, facilities: 4, valueForMoney: 5 },
    wouldRecommend: 'yes',
    reason: 'other',
    text: null,
    daysAgo: 120,
  },
];

/** The example reviews as the public list returns them, newest first. */
export function sampleReviews(now: number): PublicReview[] {
  return SAMPLE_REVIEW_DATA.map((d, i) => {
    const when = new Date(now - d.daysAgo * DAY);
    return {
      id: `sample-review-${i + 1}`,
      reviewerName: d.reviewerName,
      ratings: d.ratings,
      wouldRecommend: d.wouldRecommend,
      reason: d.reason,
      text: d.text,
      visitMonth: when.toISOString().slice(0, 7),
      earlierVisit: false,
      reply: d.reply ? { text: d.reply, at: new Date(when.getTime() + DAY).toISOString() } : null,
      publishedAt: when.toISOString(),
    };
  });
}
