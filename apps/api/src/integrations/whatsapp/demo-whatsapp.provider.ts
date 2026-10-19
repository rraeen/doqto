import { E164, hmacSha256Hex, randomId, safeEqualHex } from '../crypto';
import { ProviderInputError, SignatureVerificationError } from '../errors';
import type { IntegrationsConfig } from '../integrations.config';
import { headerValue, type SendResult, type WebhookRequest } from '../messaging.types';
import type {
  WhatsAppProvider,
  WhatsAppTemplateMessage,
  WhatsAppWebhookEvent,
} from './whatsapp.provider';

export const DEMO_WEBHOOK_SIGNATURE_HEADER = 'x-doqto-demo-signature';

export interface RecordedMessage {
  channel: 'whatsapp' | 'sms';
  providerMessageId: string;
  to: string;
  templateKey: string;
  language: string;
  params: readonly string[];
  sentAt: Date;
}

const MAX_RECORDED = 200;

/** Keeps the last few demo messages in memory, for tests and local debugging only. */
export function recordMessage(log: RecordedMessage[], message: RecordedMessage): void {
  log.push(message);
  if (log.length > MAX_RECORDED) log.splice(0, log.length - MAX_RECORDED);
}

/**
 * Demo mode: nothing is sent. The message is accepted as `sent` with no
 * network call; the notifications outbox row is what the Demo inbox shows.
 */
export class DemoWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = 'demo-whatsapp';
  readonly mode = 'demo' as const;
  readonly recorded: RecordedMessage[] = [];
  private readonly webhookSecret: string;

  constructor(config: Pick<IntegrationsConfig, 'hashPepper'>) {
    this.webhookSecret = hmacSha256Hex(config.hashPepper, 'demo-whatsapp-webhook');
  }

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult> {
    if (!E164.test(message.to)) throw new ProviderInputError('WhatsApp recipient must be E.164');
    if (!message.templateKey) throw new ProviderInputError('templateKey is required');
    const result: SendResult = {
      providerMessageId: randomId('demo_wa'),
      status: 'sent',
      sentAt: new Date(),
    };
    recordMessage(this.recorded, {
      channel: 'whatsapp',
      providerMessageId: result.providerMessageId,
      to: message.to,
      templateKey: message.templateKey,
      language: message.language,
      params: [...message.params],
      sentAt: result.sentAt,
    });
    return result;
  }

  /** Signs a body for the demo webhook simulator (INT-10). */
  signWebhookBody(rawBody: Buffer | string): string {
    return hmacSha256Hex(this.webhookSecret, rawBody);
  }

  parseWebhook(request: WebhookRequest): WhatsAppWebhookEvent[] {
    const signature = headerValue(request, DEMO_WEBHOOK_SIGNATURE_HEADER);
    if (!signature || !safeEqualHex(signature, this.signWebhookBody(request.rawBody))) {
      throw new SignatureVerificationError('demo-whatsapp');
    }
    const parsed: unknown = JSON.parse(request.rawBody.toString('utf8'));
    if (!Array.isArray(parsed)) throw new ProviderInputError('demo webhook body must be an array');
    return parsed.map((raw) => toEvent(raw));
  }
}

function toEvent(raw: unknown): WhatsAppWebhookEvent {
  if (typeof raw !== 'object' || raw === null)
    throw new ProviderInputError('bad demo webhook event');
  const e = raw as Record<string, unknown>;
  const str = (k: string): string => {
    const v = e[k];
    if (typeof v !== 'string' || v === '')
      throw new ProviderInputError(`demo webhook event needs ${k}`);
    return v;
  };
  const at = new Date(str('at'));
  if (Number.isNaN(at.getTime())) throw new ProviderInputError('demo webhook event has a bad date');
  if (e.type === 'delivery') {
    const status = str('status');
    if (status !== 'sent' && status !== 'delivered' && status !== 'read' && status !== 'failed') {
      throw new ProviderInputError('bad delivery status');
    }
    return {
      type: 'delivery',
      eventId: str('eventId'),
      providerMessageId: str('providerMessageId'),
      status,
      at,
    };
  }
  if (e.type === 'inbound') {
    const from = str('from');
    if (!E164.test(from)) throw new ProviderInputError('inbound sender must be E.164');
    return { type: 'inbound', eventId: str('eventId'), from, text: str('text'), at };
  }
  throw new ProviderInputError('unknown demo webhook event type');
}
