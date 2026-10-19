/**
 * Error envelope. Every non-2xx response from the API has this body:
 *   { "error": { "code": "OTP_INVALID", "message": "...", "details": {...}, "requestId": "..." } }
 * Clients branch on `code` (stable), never on `message` (human text, may change or be translated).
 */
import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_FAILED', // 400: body/query failed validation; `details.issues` lists fields
  'UNAUTHENTICATED', // 401: missing, invalid or expired access token
  'FORBIDDEN', // 403: authenticated but not allowed (role or clinic scope)
  'NOT_FOUND', // 404
  'CONFLICT', // 409: generic conflict
  'SLOT_TAKEN', // 409: the slot was booked by someone else (sprint 5)
  'RATE_LIMITED', // 429: `details.retryAfterSeconds` when known
  'OTP_INVALID', // 400: wrong code; `details.attemptsLeft`
  'OTP_EXPIRED', // 400: no live OTP for this phone (expired, never requested, or already used)
  'OTP_LOCKED', // 400: too many wrong codes; request a new OTP
  'REFRESH_INVALID', // 401: refresh token unknown, expired or revoked; log in again
  'ACCOUNT_SUSPENDED', // 403: user status is suspended or deleted
  'INTERNAL', // 500
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Shape of `details.issues` on `VALIDATION_FAILED`. */
export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
