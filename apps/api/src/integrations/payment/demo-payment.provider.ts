import { hmacSha256Hex, randomId, safeEqualHex } from '../crypto';
import { ProviderInputError, SignatureVerificationError } from '../errors';
import type { IntegrationsConfig } from '../integrations.config';
import { headerValue, type WebhookRequest } from '../messaging.types';
import type {
  CreateOrderRequest,
  PaymentOrder,
  PaymentProvider,
  PaymentWebhookEvent,
  RefundRequest,
  RefundResult,
  VerifyPaymentRequest,
} from './payment.provider';

export const DEMO_PAYMENT_SIGNATURE_HEADER = 'x-doqto-demo-signature';

/** Result of the "Pay Rs 15 (demo)" action: a checkout response plus the webhook it triggers. */
export interface DemoPaymentResult {
  checkout: VerifyPaymentRequest;
  webhook: WebhookRequest;
}

export function assertAmountPaise(amountPaise: number): void {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new ProviderInputError('amountPaise must be a positive integer');
  }
}

/**
 * Demo mode: no money moves. Orders and payments are `gateway: 'demo'`; the
 * demo pay action (INT-12) produces a signed checkout response and a signed
 * `payment.captured` webhook body, so confirmation runs through exactly the
 * same verify-then-confirm path as Razorpay. Signatures use the Razorpay
 * scheme (HMAC-SHA256 of `orderId|paymentId`) with a key derived from HASH_PEPPER.
 */
export class DemoPaymentProvider implements PaymentProvider {
  readonly providerName = 'demo-payment';
  readonly mode = 'demo' as const;
  readonly gateway = 'demo' as const;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly orders = new Map<string, PaymentOrder>();
  private readonly refunds = new Map<string, RefundResult>();

  constructor(config: Pick<IntegrationsConfig, 'hashPepper'>) {
    this.keySecret = hmacSha256Hex(config.hashPepper, 'demo-payment-key');
    this.webhookSecret = hmacSha256Hex(config.hashPepper, 'demo-payment-webhook');
  }

  async createOrder(request: CreateOrderRequest): Promise<PaymentOrder> {
    assertAmountPaise(request.amountPaise);
    if (!request.receipt || request.receipt.length > 40) {
      throw new ProviderInputError('receipt must be 1 to 40 characters');
    }
    const order: PaymentOrder = {
      gateway: 'demo',
      orderId: randomId('demo_order'),
      amountPaise: request.amountPaise,
      currency: 'INR',
      receipt: request.receipt,
      createdAt: new Date(),
    };
    this.orders.set(order.orderId, order);
    return order;
  }

  /** The "Pay Rs 15 (demo)" button. Caller feeds `webhook` into the webhook handler. */
  simulatePayment(order: Pick<PaymentOrder, 'orderId' | 'amountPaise'>): DemoPaymentResult {
    assertAmountPaise(order.amountPaise);
    const paymentId = randomId('demo_pay');
    const checkout: VerifyPaymentRequest = {
      orderId: order.orderId,
      paymentId,
      signature: hmacSha256Hex(this.keySecret, `${order.orderId}|${paymentId}`),
    };
    const event = {
      type: 'payment.captured',
      eventId: randomId('demo_evt'),
      orderId: order.orderId,
      paymentId,
      amountPaise: order.amountPaise,
      at: new Date().toISOString(),
    };
    return { checkout, webhook: this.signedWebhook(event) };
  }

  verifyPayment(request: VerifyPaymentRequest): boolean {
    const expected = hmacSha256Hex(this.keySecret, `${request.orderId}|${request.paymentId}`);
    return safeEqualHex(request.signature, expected);
  }

  verifyWebhook(request: WebhookRequest): PaymentWebhookEvent[] {
    const signature = headerValue(request, DEMO_PAYMENT_SIGNATURE_HEADER);
    if (
      !signature ||
      !safeEqualHex(signature, hmacSha256Hex(this.webhookSecret, request.rawBody))
    ) {
      throw new SignatureVerificationError('demo-payment');
    }
    const body: unknown = JSON.parse(request.rawBody.toString('utf8'));
    return [toEvent(body)];
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    assertAmountPaise(request.amountPaise);
    if (!request.idempotencyKey) throw new ProviderInputError('idempotencyKey is required');
    const existing = this.refunds.get(request.idempotencyKey);
    if (existing) return existing;
    const result: RefundResult = {
      refundId: randomId('demo_rfnd'),
      status: 'processed',
      amountPaise: request.amountPaise,
    };
    this.refunds.set(request.idempotencyKey, result);
    return result;
  }

  private signedWebhook(event: Record<string, unknown>): WebhookRequest {
    const rawBody = Buffer.from(JSON.stringify(event), 'utf8');
    return {
      headers: {
        'content-type': 'application/json',
        [DEMO_PAYMENT_SIGNATURE_HEADER]: hmacSha256Hex(this.webhookSecret, rawBody),
      },
      rawBody,
    };
  }
}

function toEvent(body: unknown): PaymentWebhookEvent {
  if (typeof body !== 'object' || body === null)
    throw new ProviderInputError('bad demo payment event');
  const e = body as Record<string, unknown>;
  const str = (k: string): string => {
    const v = e[k];
    if (typeof v !== 'string' || v === '')
      throw new ProviderInputError(`demo payment event needs ${k}`);
    return v;
  };
  const int = (k: string): number => {
    const v = e[k];
    if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
      throw new ProviderInputError(`demo payment event needs integer ${k}`);
    }
    return v;
  };
  const at = new Date(str('at'));
  if (Number.isNaN(at.getTime())) throw new ProviderInputError('demo payment event has a bad date');
  switch (e.type) {
    case 'payment.captured':
      return {
        type: 'payment.captured',
        eventId: str('eventId'),
        orderId: str('orderId'),
        paymentId: str('paymentId'),
        amountPaise: int('amountPaise'),
        at,
      };
    case 'payment.failed':
      return {
        type: 'payment.failed',
        eventId: str('eventId'),
        orderId: str('orderId'),
        paymentId: str('paymentId'),
        at,
        ...(typeof e.reason === 'string' ? { reason: e.reason } : {}),
      };
    case 'refund.processed':
      return {
        type: 'refund.processed',
        eventId: str('eventId'),
        paymentId: str('paymentId'),
        refundId: str('refundId'),
        amountPaise: int('amountPaise'),
        at,
      };
    default:
      throw new ProviderInputError('unknown demo payment event type');
  }
}
