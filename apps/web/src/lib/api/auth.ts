import {
  ENDPOINTS,
  MeSchema,
  OtpRequestResponseSchema,
  OtpVerifyResponseSchema,
  type Me,
  type OtpRequestResponse,
  type OtpVerifyRequest,
  type OtpVerifyResponse,
  type UpdateMeRequest,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const NoContent = z.undefined();

export function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return apiRequest(ENDPOINTS.auth.otpRequest, {
    method: 'POST',
    body: { phone, purpose: 'login' },
    schema: OtpRequestResponseSchema,
    noRefresh: true,
  });
}

export function verifyOtp(body: OtpVerifyRequest): Promise<OtpVerifyResponse> {
  return apiRequest(ENDPOINTS.auth.otpVerify, {
    method: 'POST',
    body,
    schema: OtpVerifyResponseSchema,
    noRefresh: true,
  });
}

export function logout(): Promise<void> {
  // Web sends an empty body; the API revokes the refresh token from the cookie.
  return apiRequest(ENDPOINTS.auth.logout, {
    method: 'POST',
    body: {},
    schema: NoContent,
    noRefresh: true,
  });
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return apiRequest(ENDPOINTS.me, { schema: MeSchema, signal });
}

export function updateMe(body: UpdateMeRequest): Promise<Me> {
  return apiRequest(ENDPOINTS.me, { method: 'PATCH', body, schema: MeSchema });
}

export { refreshNow } from './client';
