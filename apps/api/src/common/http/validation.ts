import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from './app-exception';

function flatten(errors: ValidationError[], parent = ''): { path: string; message: string }[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({ path, message }));
    return [...own, ...flatten(e.children ?? [], path)];
  });
}

/** Global pipe (BE-01): unknown fields are rejected, which also blocks Mongo operator injection. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid', {
        issues: flatten(errors),
      }),
  });
}
