'use client';

import type { CreateLabBookingRequest } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labsApi } from './api/lazy';

/**
 * Fetches a short-lived link to the report and saves the file. Demo storage is served by the API;
 * reaching it through `/api/v1` keeps it on this site's origin, so the browser saves it instead of
 * blocking a new tab (the same way Records downloads).
 */
export async function downloadLabReport(id: string): Promise<void> {
  const link = await labsApi.getLabReportLink(id);
  const url = new URL(link.url);
  const href = url.pathname.startsWith('/api/v1/demo-storage/')
    ? `${url.pathname}${url.search}`
    : link.url;
  const a = document.createElement('a');
  a.href = href;
  a.download = link.fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const labsKey = (city?: string) => ['labs', city ?? 'all'] as const;
export const labKey = (slug: string) => ['lab', slug] as const;
export const myLabBookingsKey = ['lab-bookings'] as const;
export const myLabBookingKey = (id: string) => ['lab-bookings', id] as const;

/** The approved labs, optionally only those in one city. */
export function useLabs(city?: string) {
  return useQuery({
    queryKey: labsKey(city),
    queryFn: ({ signal }) => labsApi.listLabs(city, signal),
    staleTime: 60_000,
  });
}

export function useLab(slug: string) {
  return useQuery({
    queryKey: labKey(slug),
    queryFn: ({ signal }) => labsApi.getLab(slug, signal),
    staleTime: 60_000,
  });
}

export function useMyLabBookings(enabled: boolean) {
  return useQuery({
    queryKey: myLabBookingsKey,
    queryFn: ({ signal }) => labsApi.listMyLabBookings(signal),
    enabled,
    // The lab answers while the patient is looking.
    refetchInterval: 30_000,
  });
}

export function useMyLabBooking(id: string, enabled: boolean) {
  return useQuery({
    queryKey: myLabBookingKey(id),
    queryFn: ({ signal }) => labsApi.getMyLabBooking(id, signal),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useCreateLabBooking(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLabBookingRequest) => labsApi.createLabBooking(slug, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: myLabBookingsKey }),
  });
}

export function useCancelLabBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => labsApi.cancelLabBooking(id),
    onSuccess: (b) => {
      qc.setQueryData(myLabBookingKey(id), b);
      void qc.invalidateQueries({ queryKey: myLabBookingsKey });
    },
  });
}
