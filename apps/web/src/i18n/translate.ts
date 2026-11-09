import {
  createTranslator as createGenericTranslator,
  type MessageKey as GenericMessageKey,
  type Translate as GenericTranslate,
  type TranslateParams,
} from '@doqto/i18n';
import type { Messages } from './messages/en';

export type MessageKey = GenericMessageKey<Messages>;
export type Translate = GenericTranslate<Messages>;
export type { TranslateParams };

export function createTranslator(messages: Messages): Translate {
  return createGenericTranslator(messages);
}
