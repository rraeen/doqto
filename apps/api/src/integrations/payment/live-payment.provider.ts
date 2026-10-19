import { createHmac } from 'node:crypto';
import { safeEqualHex } from '../crypto';
import {
  ProviderInputError,
  ProviderNotConfiguredError,
  SignatureVerificationError,
} from '../errors';
import type { IntegrationsConfig } from '../integrations.config';
import { headerValue, type WebhookRequest } from '../messaging.types';
import { assertAmountPaise } from './demo-payment.provider';
import type {
  CreateOrderRequest,
  PaymentOrder,
  PaymentProvider,
  PaymentWebhookEvent,
  RefundRequest,
  RefundResult,
  VerifyPaymentRequest,
} from './payment.provider';

type Fetch = typeof fetch;
const API = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 10_000;

/**
 * Razorpay adapter (INT-13, TDD 8): Orders API, Checkout signature check,
 * webhook signature check and refunds. Built from Razorpay's published API
 * docs and tested against fakes only. NOT YET VERIFIED AGAINST THE REAL API:
 * run the checks in infra/ENVIRONMENTS.md ("Razorpay test mode") once test
 * keys exist (test keys need a Razorpay account, not KYC).
 *
 * Secrets are never logged or put into error messages; failures report only
 * the HTTP status and Razorpay's error code.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly providerName = 'razorpay';
  readonly mode = 'live' as const;
  readonly gateway = 'razorpay' as const;

  constructor(
    private readonly razorpay: IntegrationsConfig['razorpay'],
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  async createOrder(request: CreateOrderRequest): Promise<PaymentOrder> {
    assertAmountPaise(request.amountPaise);
    if (!request.receipt || request.receipt.length > 40) {
      throw new ProviderInputError('receipt must be 1 to 40 characters');
    }
    const body = await this.call<RazorpayOrder>('POST', '/orders', {
      amount: request.amountPaise,
      currency: 'INR',
      receipt: request.receipt,
      notes: request.notes ?? {},
    });
    return {
      gateway: 'razorpay',
      orderId: body.id,
      amountPaise: body.amount,
      currency: 'INR',
      receipt: body.receipt ?? request.receipt,
      createdAt: new Date(body.created_at * 1000),
    };
  }

  /** Checkout success handler: HMAC-SHA256(`order_id|payment_id`, key secret). Never confirms by itself. */
  verifyPayment(request: VerifyPaymentRequest): boolean {
    const expected = hmacHex(this.required('keySecret'), `${request.orderId}|${request.paymentId}`);
    return safeEqualHex(request.signature, expected);
  }

  /** `X-Razorpay-Signature` = HMAC-SHA256(raw body, webhook secret), checked before parsing. */
  verifyWebhook(request: WebhookRequest): PaymentWebhookEvent[] {
    const signature = headerValue(request, 'x-razorpay-signature');
    const expected = hmacHex(this.required('webhookSecret'), request.rawBody);
    if (!signature || !safeEqualHex(signature, expected))
      throw new SignatureVerificationError('razorpay');

    const body = JSON.parse(request.rawBody.toString('utf8')) as RazorpayWebhook;
    // Razorpay sends a unique id per event in this header; it is the idempotency key.
    const eventId = headerValue(request, 'x-razorpay-event-id');
    if (!eventId) throw new ProviderInputError('razorpay webhook without x-razorpay-event-id');
    const at = new Date((body.created_at ?? Math.floor(Date.now() / 1000)) * 1000);
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;

    switch (body.event) {
      case 'payment.captured':
        if (!payment?.id || !payment.order_id)
          throw new ProviderInputError('payment.captured without ids');
        if (!isPaise(payment.amount))
          throw new ProviderInputError('payment.captured without amount');
        return [
          {
            type: 'payment.captured',
            eventId,
            orderId: payment.order_id,
            paymentId: payment.id,
            amountPaise: payment.amount,
            at,
          },
        ];
      case 'payment.failed':
        if (!payment?.id || !payment.order_id)
          throw new ProviderInputError('payment.failed without ids');
        return [
          {
            type: 'payment.failed',
            eventId,
            orderId: payment.order_id,
            paymentId: payment.id,
            at,
            ...(payment.error_reason ? { reason: payment.error_reason } : {}),
          },
        ];
      case 'refund.processed':
        if (!refund?.id || !refund.payment_id)
          throw new ProviderInputError('refund.processed without ids');
        if (!isPaise(refund.amount))
          throw new ProviderInputError('refund.processed without amount');
        return [
          {
            type: 'refund.processed',
            eventId,
            paymentId: refund.payment_id,
            refundId: refund.id,
            amountPaise: refund.amount,
            at,
          },
        ];
      default:
        // Subscribed only to the three events above; anything else is acknowledged and ignored.
        return [];
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    assertAmountPaise(request.amountPaise);
    if (!request.idempotencyKey || request.idempotencyKey.length > 40) {
      throw new ProviderInputError('idempotencyKey must be 1 to 40 characters');
    }
    const body = await this.call<RazorpayRefund>(
      'POST',
      `/payments/${encodeURIComponent(request.paymentId)}/refund`,
      {
        amount: request.amountPaise,
        speed: 'normal',
        receipt: request.idempotencyKey,
        notes: { reason: request.reason.slice(0, 256) },
      },
    );
    return {
      refundId: body.id,
      status: body.status === 'processed' ? 'processed' : 'pending',
      amountPaise: body.amount,
    };
  }

  private async call<T>(method: 'POST' | 'GET', path: string, payload?: unknown): Promise<T> {
    const auth = Buffer.from(`${this.required('keyId')}:${this.required('keySecret')}`).toString(
      'base64',
    );
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      let code = 'unknown';
      try {
        code = ((await res.json()) as { error?: { code?: string } }).error?.code ?? code;
      } catch {
        // non-JSON error body
      }
      throw new Error(
        `Razorpay ${method} ${path.split('/')[1]} failed: HTTP ${res.status} ${code}`,
      );
    }
    return (await res.json()) as T;
  }

  private required(key: keyof IntegrationsConfig['razorpay']): string {
    const value = this.razorpay[key];
    if (!value) throw new ProviderNotConfiguredError(`Razorpay (${key} missing)`);
    return value;
  }
}

const hmacHex = (secret: string, data: string | Buffer): string =>
  createHmac('sha256', secret).update(data).digest('hex');

interface RazorpayOrder {
  id: string;
  amount: number;
  receipt?: string;
  created_at: number;
}

interface RazorpayRefund {
  id: string;
  amount: number;
  status: string;
}

function isPaise(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

interface RazorpayWebhook {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string; amount?: number; error_reason?: string };
    };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
}
