import { ProviderNotConfiguredError } from '../errors';
import type { SendResult, WebhookRequest } from '../messaging.types';
import type { WhatsAppProvider, WhatsAppWebhookEvent } from './whatsapp.provider';

/** Live BSP adapter (AiSensy or Interakt). Stub until INT-20 lands. */
export class LiveWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = 'whatsapp-bsp';
  readonly mode = 'live' as const;

  async sendTemplate(): Promise<SendResult> {
    throw new ProviderNotConfiguredError('WhatsApp BSP', 'INT-20');
  }

  parseWebhook(_request: WebhookRequest): WhatsAppWebhookEvent[] {
    throw new ProviderNotConfiguredError('WhatsApp BSP webhook', 'INT-10');
  }
}
