import { randomId } from '../crypto';
import { ProviderInputError } from '../errors';
import type { SendResult } from '../messaging.types';
import type { EmailMessage, EmailProvider } from './email.provider';

/** Demo mode: accepted as `sent` with no network call; messages are kept for tests. */
export class DemoEmailProvider implements EmailProvider {
  readonly providerName = 'demo-email';
  readonly mode = 'demo' as const;
  readonly recorded: (EmailMessage & { providerMessageId: string; sentAt: Date })[] = [];

  async send(message: EmailMessage): Promise<SendResult> {
    if (!/^[^\s@]+@[^\s@]+$/.test(message.to)) throw new ProviderInputError('Email recipient is not valid');
    const result: SendResult = {
      providerMessageId: randomId('demo_email'),
      status: 'sent',
      sentAt: new Date(),
    };
    this.recorded.push({ ...message, providerMessageId: result.providerMessageId, sentAt: result.sentAt });
    return result;
  }
}
