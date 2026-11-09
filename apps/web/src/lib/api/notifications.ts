import {
  ENDPOINTS,
  MyNotificationSchema,
  UnreadCountSchema,
  pageSchema,
  type MyNotification,
  type Page,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const NoContent = z.undefined();

/** The patient's inbox, newest first. */
export function listNotifications(
  query: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<MyNotification>> {
  return apiRequest(ENDPOINTS.myNotifications, {
    query: { ...query },
    schema: pageSchema(MyNotificationSchema),
    signal,
  });
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const res = await apiRequest(ENDPOINTS.myNotificationsUnread, {
    schema: UnreadCountSchema,
    signal,
  });
  return res.count;
}

/** Marks everything in the inbox as read. */
export function markAllNotificationsRead(): Promise<void> {
  return apiRequest(ENDPOINTS.myNotificationsRead, { method: 'POST', schema: NoContent });
}
