import { ServiceUnavailableException } from '@nestjs/common';
import type { WebhookRequest } from '../messaging.types';
import type { PaymentProvider, PaymentWebhookEvent } from './payment.provider';

/**
 * Implemented by BE's payments module (BE-27): confirms the appointment in one
 * transaction on `payment.captured`, marks failures and refunds. Must be
 * idempotent on `event.eventId` and the gateway payment id, because gateways
 * retry webhooks (TDD 8).
 */
export interface PaymentEventHandler {
  handle(event: PaymentWebhookEvent): Promise<void>;
}

/**
 * The single path from a payment gateway into business code (TDD 8: the
 * webhook is the source of truth). Razorpay webhooks (INT-14) and the demo pay
 * action (INT-12) both arrive here: signature first, then the handler.
 *
 * BE registers its handler on startup instead of being injected, so the
 * integrations layer never imports the payments module:
 *   onModuleInit() { this.webhooks.registerHandler(this); }
 */
export class PaymentWebhooks {
  private handler?: PaymentEventHandler;

  constructor(private readonly provider: PaymentProvider) {}

  registerHandler(handler: PaymentEventHandler): void {
    if (this.handler && this.handler !== handler)
      throw new Error('a payment event handler is already registered');
    this.handler = handler;
  }

  /** Throws SignatureVerificationError for a bad signature, before parsing. */
  async process(request: WebhookRequest): Promise<PaymentWebhookEvent[]> {
    const events = this.provider.verifyWebhook(request);
    if (!this.handler) {
      // 503 so the gateway retries once the payments module is up.
      throw new ServiceUnavailableException('payments are not ready');
    }
    for (const event of events) await this.handler.handle(event);
    return events;
  }
}
