import type { WebhookRequest } from '../messaging.types';
import type { ProviderInfo } from '../provider-mode';

/** Stored on `payments.gateway`. */
export type PaymentGateway = 'demo' | 'razorpay';

export interface CreateOrderRequest {
  /** Integer paise, e.g. 1500 for Rs 15. */
  amountPaise: number;
  /** Our reference, the appointment id (Razorpay `receipt`, max 40 chars). */
  receipt: string;
  notes?: Readonly<Record<string, string>>;
}

export interface PaymentOrder {
  gateway: PaymentGateway;
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  receipt: string;
  createdAt: Date;
}

/** What Checkout (or the demo pay action) hands back to the client. */
export interface VerifyPaymentRequest {
  orderId: string;
  paymentId: string;
  signature: string;
}

export type PaymentWebhookEvent =
  | {
      type: 'payment.captured';
      /** Gateway event id, for idempotency. */
      eventId: string;
      orderId: string;
      paymentId: string;
      amountPaise: number;
      at: Date;
    }
  | {
      type: 'payment.failed';
      eventId: string;
      orderId: string;
      paymentId: string;
      reason?: string;
      at: Date;
    }
  | {
      type: 'refund.processed';
      eventId: string;
      paymentId: string;
      refundId: string;
      amountPaise: number;
      at: Date;
    };

export interface RefundRequest {
  paymentId: string;
  amountPaise: number;
  reason: string;
  /** Repeating a refund with the same key must not refund twice. */
  idempotencyKey: string;
}

export interface RefundResult {
  refundId: string;
  status: 'pending' | 'processed';
  amountPaise: number;
}

/**
 * Booking-fee payments (TDD 8). The webhook is the source of truth: only a
 * verified webhook event (or, in demo, the demo pay action that produces one)
 * may confirm an appointment.
 */
export interface PaymentProvider extends ProviderInfo {
  readonly gateway: PaymentGateway;
  createOrder(request: CreateOrderRequest): Promise<PaymentOrder>;
  /** Client-side success check (Checkout signature). Never confirms by itself. */
  verifyPayment(request: VerifyPaymentRequest): boolean;
  /** Verifies the signature on the raw body, then parses. Throws SignatureVerificationError. */
  verifyWebhook(request: WebhookRequest): PaymentWebhookEvent[];
  refund(request: RefundRequest): Promise<RefundResult>;
}
