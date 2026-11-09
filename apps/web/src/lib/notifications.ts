'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from './api/lazy';
import { env } from './env';

export const notificationsKey = ['notifications'] as const;
export const unreadKey = ['notifications', 'unread'] as const;

/** The inbox exists only on the real API; mock and offline runs have none. */
const available = !env.apiMocks;

/** How many messages the patient has not opened. Polled gently so the bell stays current. */
export function useUnreadCount(signedIn: boolean) {
  return useQuery({
    queryKey: unreadKey,
    queryFn: ({ signal }) => notificationsApi.getUnreadCount(signal),
    enabled: available && signedIn,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationsKey,
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.listNotifications({ cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: available,
    staleTime: 15_000,
  });
}

/** Opening the inbox marks everything read, so the badge clears. */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsRead(),
    onSuccess: () => {
      qc.setQueryData(unreadKey, 0);
      void qc.invalidateQueries({ queryKey: notificationsKey });
    },
  });
}
