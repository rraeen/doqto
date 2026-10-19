import { backoffMs, scrubError } from './jobs.service';

describe('jobs helpers', () => {
  it('backs off exponentially from 30 seconds up to an hour', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(20)).toBe(3600_000);
  });
  it('keeps phone numbers and codes out of lastError', () => {
    const text = scrubError(new Error('send to +91 98123 45678 failed, code 123456'));
    expect(text).not.toMatch(/98123|45678|123456/);
    expect(scrubError('x'.repeat(900))).toHaveLength(500);
  });
});
