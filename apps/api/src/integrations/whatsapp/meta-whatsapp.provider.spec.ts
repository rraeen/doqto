import { hmacSha256Hex } from '../crypto';
import { ProviderInputError, SignatureVerificationError } from '../errors';
import { DemoWhatsAppProvider } from './demo-whatsapp.provider';
import { AllowlistWhatsAppProvider, MetaWhatsAppProvider } from './meta-whatsapp.provider';

const CONFIG = { accessToken: 'tok_secret', phoneNumberId: '1476636895532045', appSecret: 'app' };
const MSG = {
  to: '+918971998201',
  templateKey: 'booking_confirmed',
  language: 'en' as const,
  params: ['Anil Sharma', 'Sharma Clinic', 'Mon, 12 Oct', '10:30 AM', '4821', 'https://x.in/a/1'],
};

function reply(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const http = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { http, calls };
}

describe('MetaWhatsAppProvider', () => {
  it('posts the approved template with the parameters in order', async () => {
    const { http, calls } = reply(200, { messages: [{ id: 'wamid.ABC' }] });
    const result = await new MetaWhatsAppProvider(CONFIG, http).sendTemplate(MSG);
    expect(result.providerMessageId).toBe('wamid.ABC');
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v21.0/1476636895532045/messages');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok_secret');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.to).toBe('918971998201');
    expect(body.template.name).toBe('doqto_booking_confirmed');
    expect(body.template.language.code).toBe('en');
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(
      MSG.params,
    );
  });

  it('treats a refused recipient as final and keeps the token out of the error', async () => {
    const { http } = reply(400, {
      error: { code: 131030, message: 'Recipient phone number not in allowed list' },
    });
    const err = await new MetaWhatsAppProvider(CONFIG, http).sendTemplate(MSG).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderInputError);
    expect(String(err.message)).toContain('131030');
    expect(String(err.message)).not.toContain('tok_secret');
  });

  it('lets a server error be retried', async () => {
    const { http } = reply(503, { error: { message: 'unavailable' } });
    const err = await new MetaWhatsAppProvider(CONFIG, http).sendTemplate(MSG).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ProviderInputError);
  });

  it('rejects a wrong parameter count before calling Meta', async () => {
    const { http, calls } = reply(200, {});
    await expect(
      new MetaWhatsAppProvider(CONFIG, http).sendTemplate({ ...MSG, params: ['one'] }),
    ).rejects.toBeInstanceOf(ProviderInputError);
    expect(calls).toHaveLength(0);
  });

  it('verifies the signature and parses delivery statuses', () => {
    const raw = Buffer.from(
      JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid.ABC', status: 'delivered', timestamp: '1760000000' }],
                },
              },
            ],
          },
        ],
      }),
    );
    const p = new MetaWhatsAppProvider(CONFIG);
    const sig = `sha256=${hmacSha256Hex('app', raw)}`;
    const events = p.parseWebhook({ headers: { 'x-hub-signature-256': sig }, rawBody: raw });
    expect(events).toMatchObject([
      { type: 'delivery', providerMessageId: 'wamid.ABC', status: 'delivered' },
    ]);
    expect(() => p.parseWebhook({ headers: {}, rawBody: raw })).toThrow(SignatureVerificationError);
  });
});

describe('AllowlistWhatsAppProvider', () => {
  it('sends real messages only to listed numbers', async () => {
    const { http, calls } = reply(200, { messages: [{ id: 'wamid.X' }] });
    const demo = new DemoWhatsAppProvider({ hashPepper: 'test-pepper-0123456789' });
    const p = new AllowlistWhatsAppProvider(
      new MetaWhatsAppProvider(CONFIG, http),
      demo,
      new Set(['+918971998201']),
    );
    await p.sendTemplate(MSG);
    await p.sendTemplate({ ...MSG, to: '+919000000001' });
    expect(calls).toHaveLength(1);
    expect(demo.recorded).toHaveLength(1);
  });
});

describe('MetaWhatsAppProvider text mode', () => {
  it('sends the rendered message as plain text', async () => {
    const { http, calls } = reply(200, { messages: [{ id: 'wamid.T' }] });
    await new MetaWhatsAppProvider({ ...CONFIG, sendAsText: true }, http).sendTemplate(MSG);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.type).toBe('text');
    expect(body.text.body).toContain('Dr Anil Sharma');
    expect(body.text.body).toContain('*4821*');
    expect(body.template).toBeUndefined();
  });
});
