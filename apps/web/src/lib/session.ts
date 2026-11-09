'use client';

import type { Me } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api/lazy';
import { isApiError } from './api/errors';
import { clearOfflineVisits } from './offline-card';

export const meQueryKey = ['me'] as const;

/** The signed-in user, `null` when signed out, `undefined` while loading. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async ({ signal }): Promise<Me | null> => {
      try {
        return await authApi.getMe(signal);
      } catch (err) {
        if (isApiError(err, 'UNAUTHENTICATED') || isApiError(err, 'REFRESH_INVALID')) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (me) => qc.setQueryData(meQueryKey, me),
  });
}

/** Signs out of every device, then clears this one like a normal sign-out. */
export function useLogoutAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      clearOfflineVisits();
      qc.setQueryData(meQueryKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // Signed out locally even if the network call failed; the access cookie expires in 15 minutes.
      clearOfflineVisits();
      qc.setQueryData(meQueryKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] });
    },
  });
}
