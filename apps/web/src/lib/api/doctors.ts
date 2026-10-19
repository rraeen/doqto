import {
  DoctorListItemSchema,
  DoctorProfileSchema,
  ENDPOINTS,
  pageSchema,
  type DoctorListItem,
  type DoctorProfile,
  type Page,
  type SpecialtyKey,
} from '@doqto/shared';
import { apiRequest } from './client';
import { isApiError } from './errors';

const SearchPageSchema = pageSchema(DoctorListItemSchema);

export interface DoctorSearchParams {
  city?: string;
  specialty?: SpecialtyKey;
  /** `lat,lng` */
  near?: string;
  q?: string;
  cursor?: string;
}

export function searchDoctors(
  params: DoctorSearchParams,
  signal?: AbortSignal,
): Promise<Page<DoctorListItem>> {
  return apiRequest(ENDPOINTS.doctors.search, {
    query: { ...params },
    schema: SearchPageSchema,
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
