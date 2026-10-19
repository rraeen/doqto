import { E164, randomId } from '../crypto';
import { ProviderInputError } from '../errors';
import type { SendResult } from '../messaging.types';
import { recordMessage, type RecordedMessage } from '../whatsapp/demo-whatsapp.provider';
import type { SmsMessage, SmsProvider } from './sms.provider';

/** Demo mode: accepted as `sent` with no network call. */
export class DemoSmsProvider implements SmsProvider {
  readonly providerName = 'demo-sms';
  readonly mode = 'demo' as const;
  readonly recorded: RecordedMessage[] = [];

  async send(message: SmsMessage): Promise<SendResult> {
    if (!E164.test(message.to)) throw new ProviderInputError('SMS recipient must be E.164');
    const result: SendResult = {
      providerMessageId: randomId('demo_sms'),
      status: 'sent',
      sentAt: new Date(),
    };
    recordMessage(this.recorded, {
      channel: 'sms',
      providerMessageId: result.providerMessageId,
      to: message.to,
      templateKey: message.templateKey,
      language: message.language,
      params: [...message.params],
      sentAt: result.sentAt,
    });
    return result;
  }
}
