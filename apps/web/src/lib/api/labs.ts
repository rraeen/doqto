import {
  ENDPOINTS,
  LabBookingListSchema,
  LabBookingSchema,
  LabListSchema,
  LabProfileSchema,
  LabReportLinkSchema,
  type CreateLabBookingRequest,
  type LabBooking,
  type LabBookingList,
  type LabList,
  type LabProfile,
  type LabReportLink,
} from '@doqto/shared';
import { apiRequest } from './client';

/** `q` searches test names, lab names and cities. */
export function listLabs(q?: string, signal?: AbortSignal): Promise<LabList> {
  return apiRequest(ENDPOINTS.labs.list, {
    query: q ? { q } : {},
    schema: LabListSchema,
    signal,
  });
}

export function getLab(slug: string, signal?: AbortSignal): Promise<LabProfile> {
  return apiRequest(ENDPOINTS.labs.one(slug), { schema: LabProfileSchema, signal });
}

/** A request, not a payment: the lab accepts or rejects it. */
export function createLabBooking(slug: string, body: CreateLabBookingRequest): Promise<LabBooking> {
  return apiRequest(ENDPOINTS.labs.book(slug), { method: 'POST', body, schema: LabBookingSchema });
}

export function listMyLabBookings(signal?: AbortSignal): Promise<LabBookingList> {
  return apiRequest(ENDPOINTS.myLabBookings, { schema: LabBookingListSchema, signal });
}

export function getMyLabBooking(id: string, signal?: AbortSignal): Promise<LabBooking> {
  return apiRequest(ENDPOINTS.myLabBooking(id), { schema: LabBookingSchema, signal });
}

export function cancelLabBooking(id: string): Promise<LabBooking> {
  return apiRequest(ENDPOINTS.myLabBookingCancel(id), {
    method: 'POST',
    body: {},
    schema: LabBookingSchema,
  });
}

export function getLabReportLink(id: string): Promise<LabReportLink> {
  return apiRequest(ENDPOINTS.myLabBookingReport(id), { schema: LabReportLinkSchema });
}
