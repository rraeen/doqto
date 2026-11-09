import {
  DELETE_CONFIRM_WORD,
  ENDPOINTS,
  MyDataExportSchema,
  PushSubscriptionResponseSchema,
  TransparencyResponseSchema,
  type MyDataExport,
  type PushSubscriptionRequest,
  type PushSubscriptionResponse,
  type TransparencyResponse,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const NoContent = z.undefined();

/** Registers this device for Web Push alerts like "your turn is near". */
export function registerPush(body: PushSubscriptionRequest): Promise<PushSubscriptionResponse> {
  return apiRequest(ENDPOINTS.myPushSubscriptions, {
    method: 'POST',
    body,
    schema: PushSubscriptionResponseSchema,
  });
}

export function unregisterPush(id: string): Promise<void> {
  return apiRequest(ENDPOINTS.myPushSubscription(id), { method: 'DELETE', schema: NoContent });
}

/** Everything Doqto holds about the patient, to download. */
export function exportMyData(): Promise<MyDataExport> {
  return apiRequest(ENDPOINTS.myData, { schema: MyDataExportSchema });
}

/** Deletes the account for good. The caller signs the patient out afterwards. */
export function deleteMyAccount(): Promise<void> {
  return apiRequest(ENDPOINTS.me, {
    method: 'DELETE',
    body: { confirm: DELETE_CONFIRM_WORD },
    schema: NoContent,
  });
}

export function getTransparency(signal?: AbortSignal): Promise<TransparencyResponse> {
  return apiRequest(ENDPOINTS.transparency, { schema: TransparencyResponseSchema, signal });
}
