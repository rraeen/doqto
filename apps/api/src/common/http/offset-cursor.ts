import { HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception';

/** Opaque offset cursors for lists that are sorted in memory or by a stable key (`?cursor=`). */
export function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

export function decodeOffset(cursor: string | undefined, max = 10_000): number {
  if (!cursor) return 0;
  try {
    const { o } = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { o?: unknown };
    if (typeof o === 'number' && Number.isInteger(o) && o >= 0 && o <= max) return o;
  } catch {
    // Falls through to the 400 below.
  }
  throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor', {
    issues: [{ path: 'cursor', message: 'Invalid cursor' }],
  });
}
