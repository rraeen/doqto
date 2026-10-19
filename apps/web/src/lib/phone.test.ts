import { describe, expect, it } from 'vitest';
import { formatE164ForDisplay, normaliseIndianDigits, toE164 } from './phone';

describe('phone helpers', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
  ])('normalises %s to E.164', (raw, e164) => {
    expect(toE164(raw)).toBe(e164);
  });

  it.each(['12345', '5876543210', '98765432', ''])('rejects %s', (raw) => {
    expect(toE164(raw)).toBeNull();
  });

  it('caps input at 10 digits', () => {
    expect(normaliseIndianDigits('98765432109999')).toBe('9876543210');
  });

  it('formats for display', () => {
    expect(formatE164ForDisplay('+919876543210')).toBe('+91 98765 43210');
  });
});
