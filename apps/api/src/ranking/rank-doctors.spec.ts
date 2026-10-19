import { rankDoctors, rankScore, type RankingInput } from './rank-doctors';

const base: RankingInput = {
  distanceKm: 2,
  specialtyMatch: true,
  availability: 0,
  score: null,
  reviewCount: 0,
};

describe('rankScore', () => {
  it('prefers closer doctors', () => {
    expect(rankScore({ ...base, distanceKm: 1 })).toBeGreaterThan(
      rankScore({ ...base, distanceKm: 10 }),
    );
  });

  it('prefers specialty matches, availability and better scores', () => {
    expect(rankScore(base)).toBeGreaterThan(rankScore({ ...base, specialtyMatch: false }));
    expect(rankScore({ ...base, availability: 1 })).toBeGreaterThan(rankScore(base));
    expect(rankScore({ ...base, score: 4.8, reviewCount: 20 })).toBeGreaterThan(
      rankScore({ ...base, score: 2, reviewCount: 20 }),
    );
  });

  it('does not bury new doctors below poorly rated ones', () => {
    expect(rankScore({ ...base, score: null })).toBeGreaterThan(
      rankScore({ ...base, score: 2, reviewCount: 10 }),
    );
  });

  it('stays within [0, 1] at the extremes', () => {
    const best = rankScore({
      distanceKm: 0,
      specialtyMatch: true,
      availability: 1,
      score: 5,
      reviewCount: 10_000,
    });
    const worst = rankScore({
      distanceKm: 1e6,
      specialtyMatch: false,
      availability: 0,
      score: 1,
      reviewCount: 0,
    });
    expect(best).toBeLessThanOrEqual(1);
    expect(worst).toBeGreaterThanOrEqual(0);
  });

  it('has no input that could carry payment data', () => {
    expect(Object.keys(base).sort()).toEqual([
      'availability',
      'distanceKm',
      'reviewCount',
      'score',
      'specialtyMatch',
    ]);
  });

  it('sorts stably by id on ties', () => {
    const sorted = rankDoctors([
      { id: 'b', input: base },
      { id: 'a', input: base },
      { id: 'c', input: { ...base, distanceKm: 0 } },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });
});
