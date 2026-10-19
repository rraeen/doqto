export type MessageLanguage = 'en' | 'hi';

export interface SendResult {
  providerMessageId: string;
  /** `sent` once the provider accepted it; demo providers record `sent` with no network call. */
  status: 'sent' | 'queued';
  sentAt: Date;
}

/** Raw inbound webhook: providers verify the signature on the raw bytes before parsing. */
export interface WebhookRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawBody: Buffer;
}

export function headerValue(req: WebhookRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
