import { HttpStatus } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from './app-exception';

/**
 * Runs the shared Zod schema after the DTO pipe, for cross-field rules class-validator cannot
 * express (overlapping blocks, "delay required when running late"). Same error shape as the pipe.
 */
export function zodCheck<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
    issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
