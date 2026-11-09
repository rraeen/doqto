'use client';

import type { CreateRecordFields, HealthRecord as ApiRecord } from '@doqto/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { recordsApi } from './api/lazy';
import type { RecordsFilterQuery } from './api/records';
import { env } from './env';
import type { HealthRecord, RecordFilters } from './records-view';

const recordsKey = ['records'] as const;

/** The value, but only after it has stopped changing for `ms` (typing in a search box). */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** A record from the API as the page's row type. */
export function fromApiRecord(r: ApiRecord): HealthRecord {
  return {
    id: r.id,
    kind: r.kind,
    visitType: r.visitType,
    title: r.title,
    doctor: r.doctorName,
    facility: r.facility,
    date: r.date,
    status: r.status,
    appointmentId: r.appointmentId ?? undefined,
    file: r.file,
  };
}

/** What the filter panel picked, as the API's query (the API does the filtering and paging). */
export function toQuery(filters: RecordFilters, search: string): RecordsFilterQuery {
  const q = search.trim();
  return {
    ...(q ? { q } : {}),
    ...(filters.categories.length ? { kind: filters.categories.join(',') } : {}),
    // Both types selected means no restriction.
    ...(filters.types.length === 1 ? { visitType: filters.types[0] } : {}),
    ...(filters.doctors.length ? { doctor: filters.doctors.join('|') } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}

/** The patient's records from the API, 20 at a time, narrowed by the filters and the search. */
export function useRecords(filters: RecordFilters, search: string, enabled: boolean) {
  const q = useDebounced(search, 350);
  return useInfiniteQuery({
    queryKey: [...recordsKey, 'list', filters, q],
    queryFn: ({ pageParam, signal }) =>
      recordsApi.listRecords({ ...toQuery(filters, q), cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !env.apiMocks,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useUploadRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fields: CreateRecordFields; file: File }) =>
      recordsApi.uploadRecord(input.fields, input.file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: recordsKey }),
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordsApi.deleteRecord(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: recordsKey }),
  });
}

/** Fetches a short-lived link and starts the download. Demo files go through this site's proxy. */
export async function downloadRecordFile(id: string): Promise<void> {
  const link = await recordsApi.getRecordFileLink(id);
  const url = new URL(link.url);
  // The demo storage is served by the API; reaching it through `/api/v1` keeps it same-origin.
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

/** Used by the page to know whether any filter or search narrows the list. */
export function useHasRecords(enabled: boolean) {
  return useQuery({
    queryKey: [...recordsKey, 'any'],
    queryFn: async ({ signal }) => (await recordsApi.listRecords({ limit: 1 }, signal)).total > 0,
    enabled: enabled && !env.apiMocks,
    staleTime: 30_000,
  });
}
