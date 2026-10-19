import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IntegrationsModule } from '../integrations.module';
import { testIntegrationsConfig } from '../test-config';
import { DEMO_PAY, PAYMENT_PROVIDER, PAYMENT_WEBHOOKS } from '../tokens';
import type { DemoPay } from './demo-pay';
import { DemoPaymentProvider } from './demo-payment.provider';
import type { PaymentEventHandler, PaymentWebhooks } from './payment-webhooks.service';
import type { PaymentProvider, PaymentWebhookEvent } from './payment.provider';

class RecordingHandler implements PaymentEventHandler {
  readonly events: PaymentWebhookEvent[] = [];
  async handle(event: PaymentWebhookEvent): Promise<void> {
    this.events.push(event);
  }
}

async function boot(mode: 'demo' | 'live') {
  const config = testIntegrationsConfig({
    mode,
    mongodbDbName: mode === 'demo' ? 'doqto_demo_t' : 'doqto_prod',
  });
  const ref = await Test.createTestingModule({
    imports: [IntegrationsModule.forRoot({ config })],
  }).compile();
  const app = ref.createNestApplication({ rawBody: true, logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, ref };
}

describe('demo payment flow (INT-12)', () => {
  let app: INestApplication;
  afterEach(async () => app?.close());

  it('the demo pay action confirms through the same webhook path, and the checkout response verifies', async () => {
    const booted = await boot('demo');
    app = booted.app;
    const handler = new RecordingHandler();
    booted.ref.get<PaymentWebhooks>(PAYMENT_WEBHOOKS).registerHandler(handler);
    const payment = booted.ref.get<PaymentProvider>(PAYMENT_PROVIDER);
    const order = await payment.createOrder({ amountPaise: 1500, receipt: 'appt_1' });

    const checkout = await booted.ref.get<DemoPay>(DEMO_PAY).pay(order);

    expect(handler.events).toEqual([
      expect.objectContaining({
        type: 'payment.captured',
        orderId: order.orderId,
        paymentId: checkout.paymentId,
        amountPaise: 1500,
      }),
    ]);
    expect(payment.verifyPayment(checkout)).toBe(true);
  });

  it('POST /webhooks/payments accepts a signed demo webhook and passes redeliveries through unchanged', async () => {
    const booted = await boot('demo');
    app = booted.app;
    const handler = new RecordingHandler();
    booted.ref.get<PaymentWebhooks>(PAYMENT_WEBHOOKS).registerHandler(handler);
    const provider = booted.ref.get<DemoPaymentProvider>(PAYMENT_PROVIDER);
    const { webhook } = provider.simulatePayment({ orderId: 'demo_order_1', amountPaise: 1500 });
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/webhooks/payments')
        .set(webhook.headers as Record<string, string>)
        .send(webhook.rawBody.toString());
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    // Same event id twice: the handler (BE-27) dedupes on it.
    expect(handler.events).toHaveLength(2);
    expect(handler.events[0]?.eventId).toBe(handler.events[1]?.eventId);
  });

  it('rejects unsigned and tampered webhooks with 401 before any handler runs', async () => {
    const booted = await boot('demo');
    app = booted.app;
    const handler = new RecordingHandler();
    booted.ref.get<PaymentWebhooks>(PAYMENT_WEBHOOKS).registerHandler(handler);
    const provider = booted.ref.get<DemoPaymentProvider>(PAYMENT_PROVIDER);
    const { webhook } = provider.simulatePayment({ orderId: 'demo_order_1', amountPaise: 1500 });
    const unsigned = await request(app.getHttpServer())
      .post('/api/v1/webhooks/payments')
      .set('content-type', 'application/json')
      .send(webhook.rawBody.toString());
    expect(unsigned.status).toBe(401);
    const tampered = await request(app.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set(webhook.headers as Record<string, string>)
      .send(webhook.rawBody.toString().replace('1500', '1'));
    expect(tampered.status).toBe(401);
    expect(handler.events).toHaveLength(0);
  });

  it('answers 503 until the payments module registers its handler, so the gateway retries', async () => {
    const booted = await boot('demo');
    app = booted.app;
    const provider = booted.ref.get<DemoPaymentProvider>(PAYMENT_PROVIDER);
    const { webhook } = provider.simulatePayment({ orderId: 'demo_order_1', amountPaise: 1500 });
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/payments')
      .set(webhook.headers as Record<string, string>)
      .send(webhook.rawBody.toString());
    expect(res.status).toBe(503);
  });

  it('allows only one handler', async () => {
    const booted = await boot('demo');
    app = booted.app;
    const webhooks = booted.ref.get<PaymentWebhooks>(PAYMENT_WEBHOOKS);
    const h = new RecordingHandler();
    webhooks.registerHandler(h);
    webhooks.registerHandler(h);
    expect(() => webhooks.registerHandler(new RecordingHandler())).toThrow('already registered');
  });

  it('DEMO_PAY does not exist in live mode', async () => {
    const booted = await boot('live');
    app = booted.app;
    expect(booted.ref.get(DEMO_PAY)).toBeNull();
  });
});
