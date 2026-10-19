import { Test } from '@nestjs/testing';
import { loadIntegrationsConfig } from './integrations.config';
import { IntegrationsModule } from './integrations.module';
import type { OtpProvider } from './otp/otp.provider';
import type { PaymentProvider } from './payment/payment.provider';
import type { ProviderInfo } from './provider-mode';
import { testIntegrationsConfig } from './test-config';
import {
  BOUND_PROVIDERS,
  OTP_PROVIDER,
  PAYMENT_PROVIDER,
  SMS_PROVIDER,
  STORAGE_PROVIDER,
  WHATSAPP_PROVIDER,
} from './tokens';

async function bound(mode: 'demo' | 'live') {
  const moduleRef = await Test.createTestingModule({
    imports: [IntegrationsModule.forRoot({ config: testIntegrationsConfig({ mode }) })],
  }).compile();
  return moduleRef;
}

describe('IntegrationsModule', () => {
  it('binds Demo* providers when PROVIDER_MODE=demo', async () => {
    const ref = await bound('demo');
    for (const token of [
      OTP_PROVIDER,
      WHATSAPP_PROVIDER,
      SMS_PROVIDER,
      PAYMENT_PROVIDER,
      STORAGE_PROVIDER,
    ]) {
      expect(ref.get<ProviderInfo>(token).mode).toBe('demo');
    }
    expect(ref.get<PaymentProvider>(PAYMENT_PROVIDER).gateway).toBe('demo');
    expect(
      ref
        .get<ProviderInfo[]>(BOUND_PROVIDERS)
        .map((p) => p.providerName)
        .sort(),
    ).toEqual([
      'demo-geocoder',
      'demo-otp',
      'demo-payment',
      'demo-sms',
      'demo-storage',
      'demo-whatsapp',
    ]);
  });

  it('binds live providers (stubs for now) when PROVIDER_MODE=live', async () => {
    const ref = await bound('live');
    const infos = ref.get<ProviderInfo[]>(BOUND_PROVIDERS);
    expect(infos.every((p) => p.mode === 'live')).toBe(true);
    await expect(
      ref
        .get<OtpProvider>(OTP_PROVIDER)
        .send({ phone: '+919812345678', purpose: 'login', language: 'en' }),
    ).rejects.toThrow('OTP could not be delivered');
  });

  it('end to end in demo: OTP send then verify with 123456', async () => {
    const ref = await bound('demo');
    const otp = ref.get<OtpProvider>(OTP_PROVIDER);
    const c = await otp.send({ phone: '+919812345678', purpose: 'login', language: 'en' });
    await expect(
      otp.verify({
        phone: '+919812345678',
        purpose: 'login',
        code: '123456',
        stored: { ...c, attempts: 0 },
      }),
    ).resolves.toEqual({ ok: true });
  });
});

describe('loadIntegrationsConfig', () => {
  const base = { PROVIDER_MODE: 'demo', HASH_PEPPER: 'test-pepper-0123456789' };

  it('reads mode and defaults', () => {
    const c = loadIntegrationsConfig(base);
    expect(c).toMatchObject({
      mode: 'demo',
      signedUrlTtlSeconds: 300,
      apiPublicUrl: 'http://localhost:4000',
    });
  });

  it('fails on a missing or unknown PROVIDER_MODE', () => {
    expect(() => loadIntegrationsConfig({ HASH_PEPPER: base.HASH_PEPPER })).toThrow(
      'PROVIDER_MODE',
    );
    expect(() => loadIntegrationsConfig({ ...base, PROVIDER_MODE: 'DEMO' })).toThrow(
      'PROVIDER_MODE',
    );
  });

  it('fails on a short pepper', () => {
    expect(() => loadIntegrationsConfig({ ...base, HASH_PEPPER: 'short' })).toThrow('HASH_PEPPER');
  });
});
