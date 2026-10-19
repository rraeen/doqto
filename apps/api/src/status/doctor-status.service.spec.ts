import { nextAverage } from './doctor-status.service';

describe('nextAverage (TDD 6.3 EWMA)', () => {
  it('moves 20% towards the new consult', () => {
    expect(nextAverage(8, 13)).toBe(9);
    expect(nextAverage(10, 5)).toBe(9);
  });
  it('ignores consults under 1 or over 45 minutes', () => {
    expect(nextAverage(8, 0.5)).toBe(8);
    expect(nextAverage(8, 60)).toBe(8);
  });
});
