import { dateParam, doctorNameParam, maskPhone, rupeesParam } from './message-format';
import { notificationBackoffMs } from './notification-sender.service';
import { ParamSealer } from './seal';

describe('notification helpers', () => {
  it('formats template parameters as INT-09 asks', () => {
    expect(doctorNameParam('Dr Anita Sharma')).toBe('Anita Sharma');
    expect(doctorNameParam('Dr. Rakesh')).toBe('Rakesh');
    expect(rupeesParam(1500)).toBe('15');
    expect(dateParam('2026-10-12', 'en')).toBe('Mon, 12 Oct');
    expect(dateParam('2026-10-12', 'hi')).toContain('12');
    expect(maskPhone('+919812345678')).toBe('••••5678');
  });

  it('backs off 30 s, 2 min, 8 min', () => {
    expect([1, 2, 3].map(notificationBackoffMs)).toEqual([30_000, 120_000, 480_000]);
  });

  it('seals and opens secret parameters; tampering or another key fails', () => {
    const s = new ParamSealer('pepper');
    const sealed = s.seal({ 4: '4821' });
    expect(sealed).not.toContain('4821');
    expect(s.open(sealed)).toEqual({ 4: '4821' });
    expect(() => new ParamSealer('other').open(sealed)).toThrow();
    expect(() => s.open(sealed.slice(0, -2) + 'AA')).toThrow();
  });
});
