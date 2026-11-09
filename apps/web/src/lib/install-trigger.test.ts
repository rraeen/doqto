import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markBooked } from './install-trigger';

describe('install trigger', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('remembers a first booking, and says so only once', () => {
    let events = 0;
    const count = () => (events += 1);
    window.addEventListener('doqto-has-booked-changed', count);
    markBooked();
    markBooked();
    window.removeEventListener('doqto-has-booked-changed', count);
    expect(window.localStorage.getItem('doqto-has-booked')).toBe('1');
    expect(events).toBe(1);
  });
});
