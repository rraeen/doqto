import type { ProviderInfo } from '../provider-mode';
import type { MessageLanguage, SendResult } from '../messaging.types';

export interface SmsMessage {
  /** E.164 phone. */
  to: string;
  /** DLT-registered template key, e.g. `otp_login`. */
  templateKey: string;
  language: MessageLanguage;
  params: readonly string[];
}

/** SMS fallback (MSG91), used for OTPs when WhatsApp fails and for opted-out users. */
export interface SmsProvider extends ProviderInfo {
  send(message: SmsMessage): Promise<SendResult>;
}
