import type { PublicReview } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import { sampleReviews } from './sample-reviews';
import { summarise } from './review-summary';

const NOW = Date.parse('2026-10-20T06:00:00Z');
const reviews = sampleReviews(NOW);

describe('summarise', () => {
  it('shows nothing under 5 counted reviews (New on Doqto)', () => {
    expect(summarise(reviews.slice(0, 4), NOW)).toBeNull();
  });

  it('averages each dimension and counts who would recommend', () => {
    const s = summarise(reviews, NOW)!;
    expect(s.count).toBe(6);
    expect(s.recommendPct).toBe(83); // 5 of 6 said yes
    expect(s.waitTime).toBe(3.7);
    expect(s.behaviour).toBe(4.7);
    expect(s.updatedAt).toBe(new Date(NOW).toISOString());
  });

  it('skips earlier visits by a patient who reviewed again, so one patient counts once', () => {
    const earlier: PublicReview = { ...reviews[0]!, id: 'older', earlierVisit: true };
    expect(summarise([...reviews, earlier], NOW)?.count).toBe(6);
    expect(summarise([...reviews.slice(0, 4), earlier], NOW)).toBeNull();
  });
});
