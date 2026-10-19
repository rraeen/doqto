import type { ProviderInfo } from '../provider-mode';
import type { MessageLanguage, SendResult, WebhookRequest } from '../messaging.types';

export interface WhatsAppTemplateMessage {
  /** E.164 phone, e.g. +919812345678. */
  to: string;
  /** Key into templates.ts (INT-09), e.g. `otp_login`, `booking_confirmed`. */
  templateKey: string;
  language: MessageLanguage;
  /** Positional template parameters ({{1}}, {{2}}, ...). */
  params: readonly string[];
}

export type WhatsAppDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type WhatsAppWebhookEvent =
  | {
      type: 'delivery';
      /** Provider event id, for idempotency in webhookLogs ({ source, eventId } unique). */
      eventId: string;
      providerMessageId: string;
      status: WhatsAppDeliveryStatus;
      at: Date;
      error?: string;
    }
  | {
      type: 'inbound';
      eventId: string;
      /** E.164 phone of the patient who wrote in. */
      from: string;
      text: string;
      at: Date;
    };

export interface WhatsAppProvider extends ProviderInfo {
  sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult>;
  /**
   * Verifies the signature on the raw body first, then parses.
   * Throws SignatureVerificationError for unsigned or tampered calls.
   */
  parseWebhook(request: WebhookRequest): WhatsAppWebhookEvent[];
}
