import { ProviderNotConfiguredError } from '../errors';
import type { SendResult } from '../messaging.types';
import type { EmailProvider } from './email.provider';

/** Live email adapter. Stub until an email provider is chosen (SES, Resend, Brevo...). */
export class LiveEmailProvider implements EmailProvider {
  readonly providerName = 'email';
  readonly mode = 'live' as const;

  async send(): Promise<SendResult> {
    throw new ProviderNotConfiguredError('Email');
  }
}
