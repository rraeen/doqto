import {
  ENDPOINTS,
  HealthResponseSchema,
  MeSchema,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifyRequestSchema,
  OtpVerifyResponseSchema,
  RefreshRequestSchema,
  RefreshResponseSchema,
  UpdateMeRequestSchema,
  type TokenPair,
} from '@doqto/shared';
import { delay, http, HttpResponse } from 'msw';
import * as db from './db';
import { handlersV1 } from './handlers-v1';
import { apiError, ok, parseBody, unauthenticated, url } from './respond';

/** Like the API for web clients (contract 0.2.0): tokens travel only in cookies, never in JSON. */
function tokenPair(): TokenPair {
  const now = Date.now();
  return {
    accessTokenExpiresAt: new Date(now + 15 * 60_000).toISOString(),
    refreshTokenExpiresAt: new Date(now + 30 * 86_400_000).toISOString(),
  };
}

const handlersV0 = [
  http.get(url(ENDPOINTS.health), () =>
    ok(HealthResponseSchema, { status: 'ok', version: 'mock', providerMode: 'demo' }),
  ),

  http.post(url(ENDPOINTS.auth.otpRequest), async ({ request }) => {
    const body = await parseBody(request, OtpRequestSchema);
    if (body.error) return body.error;
    await delay(400);
    const result = db.recordOtpRequest(body.data.phone);
    if (!result.ok) {
      return apiError(
        429,
        'RATE_LIMITED',
        'Too many codes requested',
        { retryAfterSeconds: result.retryAfterSeconds },
        { 'Retry-After': String(result.retryAfterSeconds) },
      );
    }
    return ok(OtpRequestResponseSchema, {
      expiresAt: new Date(result.expiresAt).toISOString(),
      channel: 'demo',
    });
  }),

  http.post(url(ENDPOINTS.auth.otpVerify), async ({ request }) => {
    const body = await parseBody(request, OtpVerifyRequestSchema);
    if (body.error) return body.error;
    await delay(400);
    const check = db.checkOtp(body.data.phone, body.data.code);
    if (!check.ok) {
      if (check.reason === 'invalid') {
        return apiError(400, 'OTP_INVALID', 'Wrong code', { attemptsLeft: check.attemptsLeft });
      }
      return check.reason === 'expired'
        ? apiError(400, 'OTP_EXPIRED', 'Code expired')
        : apiError(400, 'OTP_LOCKED', 'Too many wrong codes');
    }
    const { user, isNewUser } = db.findOrCreateUser(body.data.phone, body.data.whatsappOptIn);
    db.startSession(user.id);
    return ok(OtpVerifyResponseSchema, { ...tokenPair(), user, isNewUser });
  }),

  http.post(url(ENDPOINTS.auth.refresh), async ({ request }) => {
    const body = await parseBody(request, RefreshRequestSchema);
    if (body.error) return body.error;
    if (!db.sessionUser()) return apiError(401, 'REFRESH_INVALID', 'Log in again');
    return ok(RefreshResponseSchema, tokenPair());
  }),

  http.post(url(ENDPOINTS.auth.logout), () => {
    db.endSession();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url(ENDPOINTS.me), () => {
    const user = db.sessionUser();
    return user ? ok(MeSchema, user) : unauthenticated();
  }),

  http.patch(url(ENDPOINTS.me), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, UpdateMeRequestSchema);
    if (body.error) return body.error;
    await delay(300);
    const updated = db.updateUser(user.id, body.data);
    return updated ? ok(MeSchema, updated) : unauthenticated();
  }),
];

export const handlers = [...handlersV0, ...handlersV1];
