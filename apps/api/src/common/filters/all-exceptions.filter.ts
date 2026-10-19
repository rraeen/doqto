import { Error as MongooseError } from 'mongoose';
import { type ApiError, type ErrorCode } from '@doqto/shared';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppException } from '../http/app-exception';
import { scrubPersonalData } from '../logging/scrub';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 11000;
}

/** Renders every error as the shared envelope (packages/shared `ApiErrorSchema`). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string | number }>();
    const requestId = req.id === undefined ? undefined : String(req.id);

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError['error'] = { code: 'INTERNAL', message: 'Something went wrong' };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details };
      const retryAfter = exception.details?.retryAfterSeconds;
      if (exception.code === 'RATE_LIMITED' && typeof retryAfter === 'number') {
        res.setHeader('Retry-After', String(Math.ceil(retryAfter)));
      }
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' };
      const retryAfter = Number(res.getHeader('Retry-After'));
      if (Number.isFinite(retryAfter) && retryAfter > 0)
        body.details = { retryAfterSeconds: retryAfter };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED');
      // Never echo framework messages for 5xx; for 4xx they are safe (e.g. "Cannot GET /x").
      body = { code, message: status >= 500 ? 'Something went wrong' : exception.message };
    } else if (exception instanceof MongooseError.VersionError) {
      // optimisticConcurrency: someone saved the same document since it was loaded.
      status = HttpStatus.CONFLICT;
      body = {
        code: 'CONFLICT',
        message: 'This changed while you were working on it. Reload and try again.',
      };
    } else if (isDuplicateKeyError(exception)) {
      status = HttpStatus.CONFLICT;
      body = { code: 'CONFLICT', message: 'This already exists' };
    }

    if (status >= 500) {
      // The error object only: never the request body, which may hold phones or codes.
      // Messages can embed values (e.g. a duplicate phone), so scrub before logging.
      const name = exception instanceof Error ? exception.name : 'Error';
      const code = (exception as { code?: unknown } | null)?.code;
      const text =
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(
        `${name}${code === undefined ? '' : ` code=${String(code)}`}: ${scrubPersonalData(text)}`,
      );
    }

    if (body.details === undefined) delete body.details;
    const payload: ApiError = { error: requestId ? { ...body, requestId } : body };
    res.status(status).json(payload);
  }
}
