import { SignatureVerificationError } from '../errors';
import { DEMO_PAYMENT_SIGNATURE_HEADER, DemoPaymentProvider } from './demo-payment.provider';

const config = { hashPepper: 'test-pepper-0123456789' };

describe('DemoPaymentProvider', () => {
  it('creates demo orders in paise', async () => {
    const p = new DemoPaymentProvider(config);
    const order = await p.createOrder({ amountPaise: 1500, receipt: 'appt_1' });
    expect(order).toMatchObject({
      gateway: 'demo',
      amountPaise: 1500,
      currency: 'INR',
      receipt: 'appt_1',
    });
    expect(order.orderId).toMatch(/^demo_order_/);
    expect(p.gateway).toBe('demo');
    expect(p.mode).toBe('demo');
  });

  it.each([0, -100, 15.5, Number.NaN])('rejects amountPaise %p', async (amountPaise) => {
    const p = new DemoPaymentProvider(config);
    await expect(p.createOrder({ amountPaise, receipt: 'appt_1' })).rejects.toThrow('amountPaise');
  });

  it('rejects receipts Razorpay would reject', async () => {
    const p = new DemoPaymentProvider(config);
    await expect(p.createOrder({ amountPaise: 1500, receipt: '' })).rejects.toThrow();
    await expect(p.createOrder({ amountPaise: 1500, receipt: 'x'.repeat(41) })).rejects.toThrow();
  });

  it('demo pay produces a checkout response that verifies', async () => {
    const p = new DemoPaymentProvider(config);
    const order = await p.createOrder({ amountPaise: 1500, receipt: 'appt_1' });
    const { checkout } = p.simulatePayment(order);
    expect(checkout.orderId).toBe(order.orderId);
    expect(p.verifyPayment(checkout)).toBe(true);
    expect(p.verifyPayment({ ...checkout, paymentId: 'demo_pay_other' })).toBe(false);
    expect(p.verifyPayment({ ...checkout, signature: 'f'.repeat(64) })).toBe(false);
    expect(p.verifyPayment({ ...checkout, signature: '' })).toBe(false);
  });

  it('demo pay produces a signed payment.captured webhook for the same confirm path', async () => {
    const p = new DemoPaymentProvider(config);
    const order = await p.createOrder({ amountPaise: 1500, receipt: 'appt_1' });
    const { checkout, webhook } = p.simulatePayment(order);
    const events = p.verifyWebhook(webhook);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'payment.captured',
        orderId: order.orderId,
        paymentId: checkout.paymentId,
        amountPaise: 1500,
      }),
    ]);
    expect(events[0]?.eventId).toMatch(/^demo_evt_/);
  });

  it('rejects a webhook that is unsigned, tampered or from another key', async () => {
    const p = new DemoPaymentProvider(config);
    const order = await p.createOrder({ amountPaise: 1500, receipt: 'appt_1' });
    const { webhook } = p.simulatePayment(order);
    expect(() => p.verifyWebhook({ headers: {}, rawBody: webhook.rawBody })).toThrow(
      SignatureVerificationError,
    );
    const tampered = Buffer.from(webhook.rawBody.toString().replace('1500', '1'));
    expect(() => p.verifyWebhook({ headers: webhook.headers, rawBody: tampered })).toThrow(
      SignatureVerificationError,
    );
    const other = new DemoPaymentProvider({ hashPepper: 'another-pepper-0123456789' });
    expect(() => other.verifyWebhook(webhook)).toThrow(SignatureVerificationError);
    expect(webhook.headers[DEMO_PAYMENT_SIGNATURE_HEADER]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refunds are idempotent on the key', async () => {
    const p = new DemoPaymentProvider(config);
    const a = await p.refund({
      paymentId: 'demo_pay_1',
      amountPaise: 1500,
      reason: 'clinic_cancelled',
      idempotencyKey: 'k1',
    });
    const b = await p.refund({
      paymentId: 'demo_pay_1',
      amountPaise: 1500,
      reason: 'clinic_cancelled',
      idempotencyKey: 'k1',
    });
    const c = await p.refund({
      paymentId: 'demo_pay_1',
      amountPaise: 1500,
      reason: 'clinic_cancelled',
      idempotencyKey: 'k2',
    });
    expect(a).toEqual(b);
    expect(a.status).toBe('processed');
    expect(c.refundId).not.toBe(a.refundId);
  });
});
