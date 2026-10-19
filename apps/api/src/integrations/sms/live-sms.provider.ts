import { ProviderNotConfiguredError } from '../errors';
import type { SendResult } from '../messaging.types';
import type { SmsProvider } from './sms.provider';

/** Live MSG91 adapter. Stub until INT-20 lands (needs DLT registration). */
export class LiveSmsProvider implements SmsProvider {
  readonly providerName = 'msg91';
  readonly mode = 'live' as const;

  async send(): Promise<SendResult> {
    throw new ProviderNotConfiguredError('MSG91 SMS', 'INT-20');
  }
}
