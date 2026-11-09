import { SAMPLE_REVIEW_DATA } from '@/lib/sample-reviews';
import type { MockReview } from './db';

/** Dr Anita Sharma, the first demo doctor (see `seed.ts`). */
const ANITA = '5eed00000000000000000201';
const DAY = 86_400_000;

/** Example reviews for the first demo doctor, so the profile has bars and a list to show. */
export function seedReviews(now = Date.now()): Record<string, MockReview> {
  const list = SAMPLE_REVIEW_DATA.map((d, i): MockReview => {
    const when = new Date(now - d.daysAgo * DAY);
    return {
      id: `5eed00000000000000000${String(901 + i)}`,
      appointmentId: `5eed00000000000000000${String(801 + i)}`,
      doctorId: ANITA,
      userId: `5eed00000000000000000${String(701 + i)}`,
      reviewerName: d.reviewerName,
      ratings: d.ratings,
      wouldRecommend: d.wouldRecommend,
      reason: d.reason,
      text: d.text,
      waitedMinutes: null,
      state: 'published',
      submittedAt: when.toISOString(),
      editedAt: null,
      publishedAt: when.toISOString(),
      visitMonth: when.toISOString().slice(0, 7),
      reply: d.reply ? { text: d.reply, at: new Date(when.getTime() + DAY).toISOString() } : null,
      reports: 0,
    };
  });
  return Object.fromEntries(list.map((x) => [x.id, x]));
}
