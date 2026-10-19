import { SignatureVerificationError } from '../errors';
import { DemoSmsProvider } from '../sms/demo-sms.provider';
import { DEMO_WEBHOOK_SIGNATURE_HEADER, DemoWhatsAppProvider } from './demo-whatsapp.provider';
import { LiveWhatsAppProvider } from './live-whatsapp.provider';

const config = { hashPepper: 'test-pepper-0123456789' };

describe('DemoWhatsAppProvider', () => {
  it('records the message as sent with no network call', async () => {
    const wa = new DemoWhatsAppProvider(config);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const r = await wa.sendTemplate({
      to: '+919812345678',
      templateKey: 'booking_confirmed',
      language: 'hi',
      params: ['A', 'B'],
    });
    expect(r.status).toBe('sent');
    expect(r.providerMessageId).toMatch(/^demo_wa_/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(wa.recorded).toEqual([
      expect.objectContaining({
        channel: 'whatsapp',
        templateKey: 'booking_confirmed',
        params: ['A', 'B'],
      }),
    ]);
    fetchSpy.mockRestore();
  });

  it('caps the in-memory record', async () => {
    const wa = new DemoWhatsAppProvider(config);
    for (let i = 0; i < 205; i++) {
      await wa.sendTemplate({
        to: '+919812345678',
        templateKey: 't',
        language: 'en',
        params: [String(i)],
      });
    }
    expect(wa.recorded).toHaveLength(200);
    expect(wa.recorded[0]?.params[0]).toBe('5');
  });

  it('rejects non-E.164 recipients', async () => {
    const wa = new DemoWhatsAppProvider(config);
    await expect(
      wa.sendTemplate({ to: '98123', templateKey: 't', language: 'en', params: [] }),
    ).rejects.toThrow();
  });

  it('parses a signed simulator webhook', () => {
    const wa = new DemoWhatsAppProvider(config);
    const rawBody = Buffer.from(
      JSON.stringify([
        {
          type: 'delivery',
          eventId: 'e1',
          providerMessageId: 'demo_wa_1',
          status: 'read',
          at: '2026-10-10T05:00:00Z',
        },
        {
          type: 'inbound',
          eventId: 'e2',
          from: '+919812345678',
          text: 'STATUS',
          at: '2026-10-10T05:01:00Z',
        },
      ]),
    );
    const events = wa.parseWebhook({
      headers: { [DEMO_WEBHOOK_SIGNATURE_HEADER]: wa.signWebhookBody(rawBody) },
      rawBody,
    });
    expect(events).toEqual([
      {
        type: 'delivery',
        eventId: 'e1',
        providerMessageId: 'demo_wa_1',
        status: 'read',
        at: new Date('2026-10-10T05:00:00Z'),
      },
      {
        type: 'inbound',
        eventId: 'e2',
        from: '+919812345678',
        text: 'STATUS',
        at: new Date('2026-10-10T05:01:00Z'),
      },
    ]);
  });

  it('rejects unsigned or tampered webhooks before parsing', () => {
    const wa = new DemoWhatsAppProvider(config);
    const rawBody = Buffer.from('not json at all');
    expect(() => wa.parseWebhook({ headers: {}, rawBody })).toThrow(SignatureVerificationError);
    const sig = wa.signWebhookBody(Buffer.from('[]'));
    expect(() =>
      wa.parseWebhook({ headers: { [DEMO_WEBHOOK_SIGNATURE_HEADER]: sig }, rawBody }),
    ).toThrow(SignatureVerificationError);
  });

  it('a signature from another pepper does not verify', () => {
    const a = new DemoWhatsAppProvider(config);
    const b = new DemoWhatsAppProvider({ hashPepper: 'another-pepper-0123456789' });
    const rawBody = Buffer.from('[]');
    expect(() =>
      a.parseWebhook({
        headers: { [DEMO_WEBHOOK_SIGNATURE_HEADER]: b.signWebhookBody(rawBody) },
        rawBody,
      }),
    ).toThrow(SignatureVerificationError);
  });
});

describe('DemoSmsProvider', () => {
  it('records the message as sent', async () => {
    const sms = new DemoSmsProvider();
    const r = await sms.send({
      to: '+919812345678',
      templateKey: 'otp_login',
      language: 'en',
      params: ['123456'],
    });
    expect(r.status).toBe('sent');
    expect(sms.recorded[0]).toMatchObject({
      channel: 'sms',
      providerMessageId: r.providerMessageId,
    });
  });
});

describe('LiveWhatsAppProvider stub', () => {
  it('throws not configured', async () => {
    await expect(new LiveWhatsAppProvider().sendTemplate()).rejects.toThrow('not configured');
  });
});
