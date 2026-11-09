import {
  DoctorSearchPageSchema,
  type DoctorSearchPage,
  DoctorProfileSchema,
  ENDPOINTS,
  type DoctorProfile,
  type SpecialtyKey,
} from '@doqto/shared';
import { apiRequest } from './client';
import { isApiError } from './errors';

export interface DoctorSearchParams {
  city?: string;
  specialty?: SpecialtyKey;
  /** `lat,lng` */
  near?: string;
  q?: string;
  cursor?: string;
  /** Page size, 1 to 50; the API's default is 20. */
  limit?: number;
}

export function searchDoctors(
  params: DoctorSearchParams,
  signal?: AbortSignal,
): Promise<DoctorSearchPage> {
  return apiRequest(ENDPOINTS.doctors.search, {
    query: { ...params },
    schema: DoctorSearchPageSchema,
    signal,
  });
}

/** Public profile from the browser (the mock-mode fallback for doctors created in this browser). */
export async function getDoctorBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<DoctorProfile | null> {
  try {
    return await apiRequest(ENDPOINTS.doctors.bySlug(slug), {
      schema: DoctorProfileSchema,
      signal,
    });
  } catch (err) {
    if (isApiError(err, 'NOT_FOUND')) return null;
    throw err;
  }
}
