import type { MessageLanguage, SendResult } from '../messaging.types';
import type { ProviderInfo } from '../provider-mode';

export interface EmailMessage {
  to: string;
  /** Template key, e.g. `account_code`. The provider owns the wording. */
  templateKey: string;
  language: MessageLanguage;
  params: readonly string[];
}

/** Transactional email (sign-up and password-reset codes for providers). */
export interface EmailProvider extends ProviderInfo {
  send(message: EmailMessage): Promise<SendResult>;
}
