import {
  ENDPOINTS,
  HealthRecordSchema,
  HealthRecordsPageSchema,
  RecordFileLinkSchema,
  type CreateRecordFields,
  type HealthRecord,
  type HealthRecordsPage,
  type RecordFileLink,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const NoContent = z.undefined();

export interface RecordsFilterQuery {
  q?: string;
  /** Comma separated record kinds. */
  kind?: string;
  visitType?: 'OP' | 'IP';
  /** One or more doctor names, separated by `|`. */
  doctor?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export function listRecords(
  query: RecordsFilterQuery = {},
  signal?: AbortSignal,
): Promise<HealthRecordsPage> {
  return apiRequest(ENDPOINTS.myRecords, {
    query: { ...query },
    schema: HealthRecordsPageSchema,
    signal,
  });
}

/** Multipart: the file and the text fields about it. */
export function uploadRecord(fields: CreateRecordFields, file: File): Promise<HealthRecord> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') form.append(key, String(value));
  }
  // The file goes last: the API reads the text fields first.
  form.append('file', file, file.name);
  return apiRequest(ENDPOINTS.myRecords, {
    method: 'POST',
    formData: form,
    schema: HealthRecordSchema,
  });
}

/** A short-lived link to the file (about 5 minutes). */
export function getRecordFileLink(id: string): Promise<RecordFileLink> {
  return apiRequest(ENDPOINTS.myRecordFile(id), { schema: RecordFileLinkSchema });
}

export function deleteRecord(id: string): Promise<void> {
  return apiRequest(ENDPOINTS.myRecord(id), { method: 'DELETE', schema: NoContent });
}
