import { E164, hmacSha256Hex, safeEqualHex } from '../crypto';
import { ProviderInputError, SignatureVerificationError } from '../errors';
import { headerValue, type SendResult, type WebhookRequest } from '../messaging.types';
import { isTemplateKey, renderTemplate, WHATSAPP_TEMPLATES } from './templates';
import type {
  WhatsAppDeliveryStatus,
  WhatsAppProvider,
  WhatsAppTemplateMessage,
  WhatsAppWebhookEvent,
} from './whatsapp.provider';

export const META_GRAPH_BASE_URL = 'https://graph.facebook.com/v21.0';

export interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  /** App secret, used to verify `X-Hub-Signature-256` on webhooks. */
  appSecret?: string;
  baseUrl?: string;
  /**
   * Testing on Meta's free test account, which cannot hold custom templates: send the rendered
   * message as plain text. Meta only delivers it within 24 hours of the patient writing to the
   * number first. Never use this for real patients.
   */
  sendAsText?: boolean;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Meta error codes that retrying cannot fix: bad number, not on the test list, no such template. */
const FINAL_META_CODES = new Set([
  100, 131008, 131009, 131026, 131030, 131047, 131051, 132000, 132001, 132005, 132007, 132012,
  132015, 132016,
]);

interface MetaError {
  message?: string;
  code?: number;
  error_data?: { details?: string };
}

/**
 * WhatsApp Business Cloud API (graph.facebook.com), direct from Meta. Sends the approved
 * template that matches `templateKey` (`doqto_...` names in templates.ts) with the parameters
 * in order. The access token never appears in errors or logs.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = 'meta-whatsapp-cloud';
  readonly mode = 'live' as const;

  constructor(
    private readonly config: MetaWhatsAppConfig,
    private readonly http: FetchLike = (url, init) => fetch(url, init),
  ) {}

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult> {
    if (!E164.test(message.to)) throw new ProviderInputError('WhatsApp recipient must be E.164');
    if (!isTemplateKey(message.templateKey)) {
      throw new ProviderInputError(`Unknown WhatsApp template ${message.templateKey}`);
    }
    const template = WHATSAPP_TEMPLATES[message.templateKey];
    if (message.params.length !== template.params.length) {
      throw new ProviderInputError(
        `template ${message.templateKey} takes ${template.params.length} parameters`,
      );
    }
    const text = (t: string) => ({ type: 'text', text: t });
    const components: unknown[] = [{ type: 'body', parameters: message.params.map(text) }];
    if (template.category === 'AUTHENTICATION') {
      // Meta's "copy code" authentication templates need the code again on the button.
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [text(message.params[0] ?? '')],
      });
    }
    const res = await this.http(
      `${this.config.baseUrl ?? META_GRAPH_BASE_URL}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to.replace(/^\+/, ''),
          ...(this.config.sendAsText
            ? {
                type: 'text',
                text: {
                  body: renderTemplate(message.templateKey, message.language, message.params),
                  preview_url: true,
                },
              }
            : {
                type: 'template',
                template: {
                  name: template.bspName,
                  language: { code: message.language },
                  components,
                },
              }),
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: MetaError;
    };
    if (!res.ok || !body.messages?.[0]?.id) {
      const err = body.error ?? {};
      const detail = `${err.message ?? `HTTP ${res.status}`}${
        err.error_data?.details ? `: ${err.error_data.details}` : ''
      }`;
      const final =
        (err.code !== undefined && FINAL_META_CODES.has(err.code)) || res.status === 400;
      if (final)
        throw new ProviderInputError(`WhatsApp refused the message (${err.code}): ${detail}`);
      throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
    }
    return { providerMessageId: body.messages[0].id, status: 'sent', sentAt: new Date() };
  }

  /** Delivery statuses and inbound text from Meta, after the signature on the raw body checks out. */
  parseWebhook(request: WebhookRequest): WhatsAppWebhookEvent[] {
    const secret = this.config.appSecret;
    const given = (headerValue(request, 'x-hub-signature-256') ?? '').replace(/^sha256=/, '');
    if (!secret || !safeEqualHex(given, hmacSha256Hex(secret, request.rawBody))) {
      throw new SignatureVerificationError('whatsapp');
    }
    const payload = JSON.parse(request.rawBody.toString('utf8')) as {
      entry?: { changes?: { value?: MetaValue }[] }[];
    };
    const events: WhatsAppWebhookEvent[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        for (const s of value.statuses ?? []) {
          const status = STATUS_MAP[s.status ?? ''];
          if (!s.id || !status) continue;
          events.push({
            type: 'delivery',
            eventId: `${s.id}:${s.status}`,
            providerMessageId: s.id,
            status,
            at: new Date(Number(s.timestamp ?? 0) * 1000),
            error: s.errors?.[0]?.title,
          });
        }
        for (const m of value.messages ?? []) {
          if (!m.id || !m.from || m.type !== 'text') continue;
          events.push({
            type: 'inbound',
            eventId: m.id,
            from: `+${m.from}`,
            text: m.text?.body ?? '',
            at: new Date(Number(m.timestamp ?? 0) * 1000),
          });
        }
      }
    }
    return events;
  }
}

const STATUS_MAP: Record<string, WhatsAppDeliveryStatus | undefined> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

interface MetaValue {
  statuses?: {
    id?: string;
    status?: string;
    timestamp?: string;
    errors?: { title?: string }[];
  }[];
  messages?: {
    id?: string;
    from?: string;
    type?: string;
    timestamp?: string;
    text?: { body?: string };
  }[];
}

/**
 * Demo-mode safety for a real sender: only numbers on the test list get a real WhatsApp message;
 * everyone else (seeded demo patients, other testers) is handled by the demo provider, so a
 * local run can never message a real person by accident.
 */
export class AllowlistWhatsAppProvider implements WhatsAppProvider {
  readonly providerName: string;
  readonly mode = 'demo' as const;

  constructor(
    private readonly real: WhatsAppProvider,
    private readonly fallback: WhatsAppProvider,
    private readonly allowed: ReadonlySet<string>,
  ) {
    this.providerName = `${real.providerName}+allowlist`;
  }

  sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult> {
    return (this.allowed.has(message.to) ? this.real : this.fallback).sendTemplate(message);
  }

  parseWebhook(request: WebhookRequest): WhatsAppWebhookEvent[] {
    return this.real.parseWebhook(request);
  }
}
