import type { Translate } from '@/i18n/translate';
import { detailNumber, isApiError, isNetworkError } from './errors';

/** Maps an auth error to the sentence shown under the field. */
export function authErrorMessage(err: unknown, t: Translate): string {
  if (isNetworkError(err)) return t('common.offline');
  if (!isApiError(err)) return t('common.somethingWrong');
  switch (err.code) {
    case 'VALIDATION_FAILED':
      return t('auth.phoneInvalid');
    case 'RATE_LIMITED': {
      const seconds = detailNumber(err, 'retryAfterSeconds');
      return seconds
        ? t('auth.rateLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
        : t('auth.rateLimitedSoon');
    }
    case 'OTP_INVALID': {
      const left = detailNumber(err, 'attemptsLeft');
      return left === undefined ? t('auth.wrongCodeNoCount') : t('auth.wrongCode', { left });
    }
    case 'OTP_EXPIRED':
      return t('auth.expiredCode');
    case 'OTP_LOCKED':
      return t('auth.lockedOut');
    case 'ACCOUNT_SUSPENDED':
      return t('auth.suspended');
    default:
      return t('common.somethingWrong');
  }
}
