import {
  ClinicPrivateSchema,
  ENDPOINTS,
  GeocodeResponseSchema,
  type AddStaffRequest,
  type ClinicPrivate,
  type CreateClinicRequest,
  type GeocodeQuery,
  type GeocodeResponse,
  type UpdateClinicRequest,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const ClinicListSchema = z.object({ items: z.array(ClinicPrivateSchema) });

export async function listMyClinics(signal?: AbortSignal): Promise<ClinicPrivate[]> {
  return (await apiRequest(ENDPOINTS.clinics.mine, { schema: ClinicListSchema, signal })).items;
}

export function getClinic(id: string, signal?: AbortSignal): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.byId(id), { schema: ClinicPrivateSchema, signal });
}

export function createClinic(body: CreateClinicRequest): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.create, {
    method: 'POST',
    body,
    schema: ClinicPrivateSchema,
  });
}

export function updateClinic(id: string, body: UpdateClinicRequest): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.byId(id), {
    method: 'PATCH',
    body,
    schema: ClinicPrivateSchema,
  });
}

export function addClinicPhoto(id: string, file: File): Promise<ClinicPrivate> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest(ENDPOINTS.clinics.photos(id), {
    method: 'POST',
    formData,
    schema: ClinicPrivateSchema,
  });
}

export function deleteClinicPhoto(id: string, index: number): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.photo(id, index), {
    method: 'DELETE',
    schema: ClinicPrivateSchema,
  });
}

export function addStaff(id: string, body: AddStaffRequest): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.staff(id), {
    method: 'POST',
    body,
    schema: ClinicPrivateSchema,
  });
}

export function removeStaff(id: string, userId: string): Promise<ClinicPrivate> {
  return apiRequest(ENDPOINTS.clinics.staffMember(id, userId), {
    method: 'DELETE',
    schema: ClinicPrivateSchema,
  });
}

export function geocode(query: GeocodeQuery): Promise<GeocodeResponse> {
  return apiRequest(ENDPOINTS.geo.geocode, { query, schema: GeocodeResponseSchema });
}
