import type { ErrorCode } from '@doqto/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** A contract `ErrorCode`, or `HTTP_<status>` when the body was not the contract envelope. */
    readonly code: ErrorCode | `HTTP_${number}`,
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when a response does not match the shared contract schema. */
export class ContractError extends Error {
  constructor(
    readonly path: string,
    readonly issues: unknown,
  ) {
    super(`Response from ${path} did not match the API contract`);
    this.name = 'ContractError';
  }
}

export function isApiError(err: unknown, code?: ErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code);
}

/** Network failure (offline, DNS, CORS) before any HTTP response. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export function detailNumber(err: ApiError, key: string): number | undefined {
  const v = err.details[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
