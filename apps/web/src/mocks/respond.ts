import type { ErrorCode } from '@doqto/shared';
import { HttpResponse, type JsonBodyType } from 'msw';
import type { z } from 'zod';
import { env } from '@/lib/env';

export const url = (path: string) => env.apiUrl + path;

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  headers?: HeadersInit,
) {
  return HttpResponse.json(
    { error: { code, message, details, requestId: 'mock' } },
    { status, headers },
  );
}

/** Mocks must speak the contract too: responses are parsed with the shared schema before sending. */
export function ok<S extends z.ZodTypeAny>(schema: S, body: z.input<S>, status = 200) {
  return HttpResponse.json(schema.parse(body) as JsonBodyType, { status });
}

export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { data: parsed.data as z.infer<S> };
  const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  return { error: apiError(400, 'VALIDATION_FAILED', 'Validation failed', { issues }) };
}

export const unauthenticated = () => apiError(401, 'UNAUTHENTICATED', 'Log in to continue');
