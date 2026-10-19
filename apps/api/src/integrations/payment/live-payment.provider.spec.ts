// Razorpay adapter against fakes. Shapes follow Razorpay's API docs; NOT yet
// verified against the real API (needs test keys).
import { createHmac } from 'node:crypto';
import {
  ProviderInputError,
  ProviderNotConfiguredError,
  SignatureVerificationError,
} from '../errors';
import { RazorpayPaymentProvider } from './live-payment.provider';

const keys = { keyId: 'rzp_test_abc', keySecret: 'key-secret-xyz', webhookSecret: 'whsec-123' };
const hmac = (secret: string, data: string | Buffer) =>
  createHmac('sha256', secret).update(data).digest('hex');

function fake(responses: Array<{ status?: number; body: unknown }>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { calls, impl };
}

function webhook(body: unknown, opts: { secret?: string; eventId?: string } = {}) {
  const rawBody = Buffer.from(JSON.stringify(body));
  return {
    rawBody,
    headers: {
      'x-razorpay-signature': hmac(opts.secret ?? keys.webhookSecret, rawBody),
      'x-razorpay-event-id': opts.eventId ?? 'evt_1',
    },
  };
}

describe('RazorpayPaymentProvider (unverified against the real API)', () => {
  it('creates an order with Basic auth, amount in paise and INR', async () => {
    const f = fake([
      {
        body: {
          id: 'order_9A33XWu170gUtm',
          amount: 1500,
          currency: 'INR',
          receipt: 'appt_1',
          created_at: 1760054400,
        },
      },
    ]);
    const p = new RazorpayPaymentProvider(keys, f.impl);
    const order = await p.createOrder({
      amountPaise: 1500,
      receipt: 'appt_1',
      notes: { appointmentId: 'appt_1' },
    });
    expect(order).toEqual({
      gateway: 'razorpay',
      orderId: 'order_9A33XWu170gUtm',
      amountPaise: 1500,
      currency: 'INR',
      receipt: 'appt_1',
      createdAt: new Date(1760054400 * 1000),
    });
    const call = f.calls[0]!;
    expect(call.url).toBe('https://api.razorpay.com/v1/orders');
    expect((call.init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('rzp_test_abc:key-secret-xyz').toString('base64')}`,
    );
    expect(JSON.parse(call.init.body as string)).toEqual({
      amount: 1500,
      currency: 'INR',
      receipt: 'appt_1',
      notes: { appointmentId: 'appt_1' },
    });
  });

  it('reports API failures with status and error code only, never secrets', async () => {
    const f = fake([
      {
        status: 401,
        body: { error: { code: 'BAD_REQUEST_ERROR', description: 'key-secret-xyz invalid' } },
      },
    ]);
    const err = await new RazorpayPaymentProvider(keys, f.impl)
      .createOrder({ amountPaise: 1500, receipt: 'a' })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe('Razorpay POST orders failed: HTTP 401 BAD_REQUEST_ERROR');
    expect((err as Error).message).not.toContain('key-secret');
  });

  it('verifies the Checkout signature as HMAC(order_id|payment_id, key secret)', () => {
    const p = new RazorpayPaymentProvider(keys, fake([]).impl);
    const signature = hmac(keys.keySecret, 'order_1|pay_1');
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature })).toBe(true);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_2', signature })).toBe(false);
    expect(
      p.verifyPayment({
        orderId: 'order_1',
        paymentId: 'pay_1',
        signature: hmac('other', 'order_1|pay_1'),
      }),
    ).toBe(false);
  });

  it('parses payment.captured, payment.failed and refund.processed after the signature check', () => {
    const p = new RazorpayPaymentProvider(keys, fake([]).impl);
    const captured = webhook({
      entity: 'event',
      event: 'payment.captured',
      created_at: 1760054400,
      payload: {
        payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 1500, status: 'captured' } },
      },
    });
    expect(p.verifyWebhook(captured)).toEqual([
      {
        type: 'payment.captured',
        eventId: 'evt_1',
        orderId: 'order_1',
        paymentId: 'pay_1',
        amountPaise: 1500,
        at: new Date(1760054400 * 1000),
      },
    ]);
    const failed = webhook(
      {
        event: 'payment.failed',
        created_at: 1,
        payload: {
          payment: {
            entity: {
              id: 'pay_2',
              order_id: 'order_1',
              amount: 1500,
              error_reason: 'payment_cancelled',
            },
          },
        },
      },
      { eventId: 'evt_2' },
    );
    expect(p.verifyWebhook(failed)).toEqual([
      expect.objectContaining({ type: 'payment.failed', reason: 'payment_cancelled' }),
    ]);
    const refund = webhook(
      {
        event: 'refund.processed',
        created_at: 1,
        payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 1500 } } },
      },
      { eventId: 'evt_3' },
    );
    expect(p.verifyWebhook(refund)).toEqual([
      expect.objectContaining({ type: 'refund.processed', refundId: 'rfnd_1', paymentId: 'pay_1' }),
    ]);
    expect(p.verifyWebhook(webhook({ event: 'order.paid', payload: {} }))).toEqual([]);
  });

  it('rejects unsigned, tampered or wrongly keyed webhooks before parsing', () => {
    const p = new RazorpayPaymentProvider(keys, fake([]).impl);
    expect(() => p.verifyWebhook({ headers: {}, rawBody: Buffer.from('not json') })).toThrow(
      SignatureVerificationError,
    );
    const w = webhook({ event: 'payment.captured' }, { secret: 'wrong' });
    expect(() => p.verifyWebhook(w)).toThrow(SignatureVerificationError);
    const ok = webhook({ event: 'payment.captured' });
    expect(() =>
      p.verifyWebhook({
        headers: ok.headers,
        rawBody: Buffer.from(ok.rawBody.toString().replace('captured', 'failed')),
      }),
    ).toThrow(SignatureVerificationError);
  });

  it('refuses captured and refund events without a positive integer amount', () => {
    const p = new RazorpayPaymentProvider(keys, fake([]).impl);
    const noAmount = webhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } },
    });
    expect(() => p.verifyWebhook(noAmount)).toThrow(ProviderInputError);
    const badRefund = webhook({
      event: 'refund.processed',
      payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: '1500' } } },
    });
    expect(() => p.verifyWebhook(badRefund)).toThrow(ProviderInputError);
  });

  it('requires the event id header for idempotency', () => {
    const p = new RazorpayPaymentProvider(keys, fake([]).impl);
    const w = webhook({ event: 'payment.captured' });
    const { 'x-razorpay-event-id': _omit, ...headers } = w.headers;
    expect(() => p.verifyWebhook({ headers, rawBody: w.rawBody })).toThrow('x-razorpay-event-id');
  });

  it('refunds in paise with the idempotency key as receipt', async () => {
    const f = fake([{ body: { id: 'rfnd_1', amount: 1500, status: 'processed' } }]);
    const r = await new RazorpayPaymentProvider(keys, f.impl).refund({
      paymentId: 'pay_1',
      amountPaise: 1500,
      reason: 'clinic_cancelled',
      idempotencyKey: 'refund:appt_1',
    });
    expect(r).toEqual({ refundId: 'rfnd_1', status: 'processed', amountPaise: 1500 });
    expect(f.calls[0]?.url).toBe('https://api.razorpay.com/v1/payments/pay_1/refund');
    expect(JSON.parse(f.calls[0]?.init.body as string)).toEqual({
      amount: 1500,
      speed: 'normal',
      receipt: 'refund:appt_1',
      notes: { reason: 'clinic_cancelled' },
    });
  });

  it('throws not configured when keys are missing, before any network call', async () => {
    const f = fake([]);
    const p = new RazorpayPaymentProvider({}, f.impl);
    await expect(p.createOrder({ amountPaise: 1500, receipt: 'a' })).rejects.toThrow(
      ProviderNotConfiguredError,
    );
    expect(() => p.verifyWebhook({ headers: {}, rawBody: Buffer.from('{}') })).toThrow(
      ProviderNotConfiguredError,
    );
    expect(f.calls).toHaveLength(0);
  });
});
