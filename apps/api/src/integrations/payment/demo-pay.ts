import type { PaymentWebhooks } from './payment-webhooks.service';
import type { DemoPaymentProvider } from './demo-payment.provider';
import type { PaymentOrder, VerifyPaymentRequest } from './payment.provider';

/**
 * The "Pay Rs 15 (demo)" button (INT-12, TDD 13). Bound as DEMO_PAY in demo
 * mode only; in live mode the token is `null`, so business code cannot reach
 * a demo payment by accident. It produces a signed `payment.captured` webhook
 * and pushes it through PaymentWebhooks.process(), the same verify-then-confirm
 * path a real Razorpay webhook takes. BE-27 exposes it behind auth and order
 * ownership checks, e.g. POST /payments/:id/demo-pay.
 */
export interface DemoPay {
  pay(order: Pick<PaymentOrder, 'orderId' | 'amountPaise'>): Promise<VerifyPaymentRequest>;
}

export function createDemoPay(provider: DemoPaymentProvider, webhooks: PaymentWebhooks): DemoPay {
  return {
    async pay(order) {
      const { checkout, webhook } = provider.simulatePayment(order);
      await webhooks.process(webhook);
      return checkout;
    },
  };
}
