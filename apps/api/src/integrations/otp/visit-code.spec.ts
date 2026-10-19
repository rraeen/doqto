import { Test } from '@nestjs/testing';
import { IntegrationsModule } from '../integrations.module';
import { testIntegrationsConfig } from '../test-config';
import { OTP_PROVIDER, VISIT_CODES, WHATSAPP_PROVIDER } from '../tokens';
import type { DemoWhatsAppProvider } from '../whatsapp/demo-whatsapp.provider';
import { renderTemplate } from '../whatsapp/templates';
import type { OtpProvider } from './otp.provider';
import { VisitCodes } from './visit-code';

const PEPPER = 'test-pepper-0123456789';

describe('VisitCodes', () => {
  it('issues random 4-digit codes and stores only a hash', () => {
    const v = new VisitCodes(PEPPER, 'live');
    const issued = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { code, hash } = v.issue('appt1');
      expect(code).toMatch(/^\d{4}$/);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // Peppered HMAC bound to the appointment, so the bare code cannot be looked up.
      expect(v.matches('appt1', code, hash)).toBe(true);
      expect(v.matches('appt2', code, hash)).toBe(false);
      issued.add(code);
    }
    expect(issued.size).toBeGreaterThan(1);
  });

  it('checks a code against its own appointment only', () => {
    const v = new VisitCodes(PEPPER, 'live');
    const { code, hash } = v.issue('appt1');
    expect(v.matches('appt1', code, hash)).toBe(true);
    expect(v.matches('appt2', code, hash)).toBe(false);
    const wrong = code === '0000' ? '0001' : '0000';
    expect(v.matches('appt1', wrong, hash)).toBe(false);
    expect(v.matches('appt1', `${code}0`, hash)).toBe(false);
  });

  it('accepts 123456 in demo mode only (TDD 13)', () => {
    const demo = new VisitCodes(PEPPER, 'demo');
    const live = new VisitCodes(PEPPER, 'live');
    const { hash } = live.issue('appt1');
    expect(demo.matches('appt1', '123456', hash)).toBe(true);
    expect(live.matches('appt1', '123456', hash)).toBe(false);
  });
});

describe('walk-in check-in OTP (INT-08)', () => {
  async function bound(mode: 'demo' | 'live') {
    const config = testIntegrationsConfig({
      mode,
      mongodbDbName: mode === 'demo' ? 'doqto_demo_t' : 'doqto_prod',
    });
    return Test.createTestingModule({
      imports: [IntegrationsModule.forRoot({ config })],
    }).compile();
  }

  it('demo: sends the visit OTP through the WhatsApp provider only, with no outbox and no network', async () => {
    const ref = await bound('demo');
    const otp = ref.get<OtpProvider>(OTP_PROVIDER);
    const wa = ref.get<DemoWhatsAppProvider>(WHATSAPP_PROVIDER);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const c = await otp.send({ phone: '+919812345678', purpose: 'visit', language: 'hi' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(c.channel).toBe('whatsapp');
    expect(wa.recorded.at(-1)).toMatchObject({
      templateKey: 'otp_visit',
      language: 'hi',
      params: ['123456'],
    });
    expect(renderTemplate('otp_visit', 'hi', ['123456'])).toContain('123456');
    await expect(
      otp.verify({
        phone: '+919812345678',
        purpose: 'visit',
        code: '123456',
        stored: { ...c, attempts: 0 },
      }),
    ).resolves.toEqual({ ok: true });
    // A login OTP cannot be replayed as a visit OTP.
    await expect(
      otp.verify({
        phone: '+919812345678',
        purpose: 'login',
        code: '123456',
        stored: { ...c, attempts: 0 },
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it('live: fails loudly until the BSP and MSG91 adapters land (INT-20)', async () => {
    const ref = await bound('live');
    await expect(
      ref
        .get<OtpProvider>(OTP_PROVIDER)
        .send({ phone: '+919812345678', purpose: 'visit', language: 'en' }),
    ).rejects.toThrow('OTP could not be delivered');
  });

  it('binds VisitCodes with the configured mode', async () => {
    expect((await bound('demo')).get<VisitCodes>(VISIT_CODES).mode).toBe('demo');
    expect((await bound('live')).get<VisitCodes>(VISIT_CODES).mode).toBe('live');
  });
});
