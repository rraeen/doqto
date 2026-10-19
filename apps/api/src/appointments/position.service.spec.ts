import { estimateWaitMinutes, waitRange } from './position.service';

describe('wait estimate (TDD 6.3)', () => {
  const now = new Date('2026-10-10T05:00:00.000Z');
  it('is tokens ahead times the average consult', () => {
    expect(
      estimateWaitMinutes({
        tokensAhead: 3,
        avgConsultMinutes: 8,
        state: 'in_clinic',
        etaAt: null,
        now,
      }),
    ).toBe(24);
  });
  it('adds the time until the doctor arrives when late or not started', () => {
    const etaAt = new Date(now.getTime() + 20 * 60_000);
    expect(
      estimateWaitMinutes({
        tokensAhead: 1,
        avgConsultMinutes: 8,
        state: 'running_late',
        etaAt,
        now,
      }),
    ).toBe(28);
    expect(
      estimateWaitMinutes({ tokensAhead: 1, avgConsultMinutes: 8, state: 'in_clinic', etaAt, now }),
    ).toBe(8);
  });
  it('is shown as a range about 20% either side', () => {
    expect(waitRange(25)).toEqual({ min: 20, max: 30 });
    expect(waitRange(0)).toEqual({ min: 0, max: 0 });
  });
});
