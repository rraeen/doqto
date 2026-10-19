import { type ErrorCode } from '@doqto/shared';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * The one exception business code throws. The global filter renders it as the shared
 * error envelope `{ error: { code, message, details } }`.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static unauthenticated(message = 'Log in to continue'): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have access to this'): AppException {
    return new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): AppException {
    return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
  }

  static rateLimited(retryAfterSeconds?: number): AppException {
    return new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMITED',
      'Too many requests. Please wait and try again.',
      retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
    );
  }
}
