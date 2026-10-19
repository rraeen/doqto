import { ProviderNotConfiguredError } from '../errors';
import { DemoSmsProvider } from '../sms/demo-sms.provider';
import { LiveSmsProvider } from '../sms/live-sms.provider';
import { DemoWhatsAppProvider } from '../whatsapp/demo-whatsapp.provider';
import { LiveWhatsAppProvider } from '../whatsapp/live-whatsapp.provider';
import { DEMO_FIXED_OTP, DemoOtpProvider } from './demo-otp.provider';
import { LiveOtpProvider } from './live-otp.provider';
import { OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS, type StoredOtp } from './otp.provider';

const PEPPER = 'test-pepper-0123456789';
const PHONE = '+919812345678';

function setup() {
  const whatsapp = new DemoWhatsAppProvider({ hashPepper: PEPPER });
  const sms = new DemoSmsProvider();
  const otp = new DemoOtpProvider(PEPPER, whatsapp, sms);
  return { whatsapp, sms, otp };
}

describe('DemoOtpProvider', () => {
  it('is a demo provider and the fixed code is 123456', () => {
    expect(setup().otp.mode).toBe('demo');
    expect(DEMO_FIXED_OTP).toBe('123456');
  });

  it('sends without a network call and returns only a hash with a 5-minute expiry', async () => {
    const { otp, whatsapp } = setup();
    const before = Date.now();
    const challenge = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    expect(challenge.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(challenge.codeHash).not.toContain(DEMO_FIXED_OTP);
    expect(challenge.channel).toBe('whatsapp');
    expect(challenge.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      OTP_TTL_SECONDS * 1000 - 50,
    );
    expect(challenge.expiresAt.getTime() - before).toBeLessThanOrEqual(
      OTP_TTL_SECONDS * 1000 + 1000,
    );
    expect(whatsapp.recorded).toHaveLength(1);
    expect(whatsapp.recorded[0]).toMatchObject({
      to: PHONE,
      templateKey: 'otp_login',
      params: ['123456'],
    });
  });

  it('accepts 123456 for any phone number', async () => {
    const { otp } = setup();
    for (const phone of [PHONE, '+919000000001', '+14155550123']) {
      const c = await otp.send({ phone, purpose: 'login', language: 'hi' });
      const stored: StoredOtp = { codeHash: c.codeHash, expiresAt: c.expiresAt, attempts: 0 };
      await expect(
        otp.verify({ phone, purpose: 'login', code: '123456', stored }),
      ).resolves.toEqual({ ok: true });
    }
  });

  it('rejects any other code', async () => {
    const { otp } = setup();
    const c = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    const stored = { codeHash: c.codeHash, expiresAt: c.expiresAt, attempts: 0 };
    for (const code of ['654321', '12345', '1234567', 'abcdef', '']) {
      await expect(otp.verify({ phone: PHONE, purpose: 'login', code, stored })).resolves.toEqual({
        ok: false,
        reason: 'invalid_code',
      });
    }
  });

  it('still enforces the attempt limit, even for the fixed code', async () => {
    const { otp } = setup();
    const c = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    let stored: StoredOtp = { codeHash: c.codeHash, expiresAt: c.expiresAt, attempts: 0 };
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await otp.verify({ phone: PHONE, purpose: 'login', code: '000000', stored });
      expect(r).toEqual({ ok: false, reason: 'invalid_code' });
      stored = { ...stored, attempts: stored.attempts + 1 };
    }
    await expect(
      otp.verify({ phone: PHONE, purpose: 'login', code: '123456', stored }),
    ).resolves.toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('still enforces expiry', async () => {
    const { otp } = setup();
    const c = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    const stored = { codeHash: c.codeHash, expiresAt: c.expiresAt, attempts: 0 };
    const now = new Date(c.expiresAt.getTime() + 1);
    await expect(
      otp.verify({ phone: PHONE, purpose: 'login', code: '123456', stored, now }),
    ).resolves.toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('binds the hash to phone and purpose', async () => {
    const { otp } = setup();
    const c = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    const stored = { codeHash: c.codeHash, expiresAt: c.expiresAt, attempts: 0 };
    await expect(
      otp.verify({ phone: '+919812345679', purpose: 'login', code: '123456', stored }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      otp.verify({ phone: PHONE, purpose: 'visit', code: '123456', stored }),
    ).resolves.toMatchObject({
      ok: false,
    });
  });

  it('uses the visit template for walk-in OTPs', async () => {
    const { otp, whatsapp } = setup();
    await otp.send({ phone: PHONE, purpose: 'visit', language: 'hi' });
    expect(whatsapp.recorded[0]).toMatchObject({ templateKey: 'otp_visit', language: 'hi' });
  });

  it('rejects a phone that is not E.164', async () => {
    const { otp } = setup();
    await expect(
      otp.send({ phone: '9812345678', purpose: 'login', language: 'en' }),
    ).rejects.toThrow('E.164');
  });

  it('falls back to SMS when WhatsApp fails', async () => {
    const sms = new DemoSmsProvider();
    const otp = new DemoOtpProvider(PEPPER, new LiveWhatsAppProvider(), sms);
    const c = await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
    expect(c.channel).toBe('sms');
    expect(sms.recorded).toHaveLength(1);
  });
});

describe('LiveOtpProvider (stub delivery until INT-20)', () => {
  it('fails loudly because no live channel is configured', async () => {
    const otp = new LiveOtpProvider(PEPPER, new LiveWhatsAppProvider(), new LiveSmsProvider());
    expect(otp.mode).toBe('live');
    const err = await otp
      .send({ phone: PHONE, purpose: 'login', language: 'en' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(
      (err as AggregateError).errors.every((e) => e instanceof ProviderNotConfiguredError),
    ).toBe(true);
  });

  it('generates random 6-digit codes, never the demo code by construction', async () => {
    const sms = new DemoSmsProvider();
    const otp = new LiveOtpProvider(PEPPER, new LiveWhatsAppProvider(), sms);
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await otp.send({ phone: PHONE, purpose: 'login', language: 'en' });
      const code = sms.recorded.at(-1)?.params[0] ?? '';
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
