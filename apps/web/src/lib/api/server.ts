import 'server-only';
import { DoctorProfileSchema, ENDPOINTS, type DoctorProfile } from '@doqto/shared';
import { env } from '@/lib/env';

/**
 * Server-side reads for SSR pages (public data only, no cookies). On the demo the browser uses
 * the same-origin `/api/v1`, so the server goes straight to `API_PROXY_TARGET` instead.
 */
function serverApiBase(): string {
  const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');
  if (target) return `${target}/api/v1`;
  if (/^https?:\/\//.test(env.apiUrl)) return env.apiUrl;
  return `http://localhost:4000${env.apiUrl}`;
}

/** Public doctor profile, `null` when not found or not listed. Cached for 60 seconds. */
export async function fetchDoctorProfile(slug: string): Promise<DoctorProfile | null> {
  if (env.apiMocks) {
    const { mockPublicProfile } = await import('@/mocks/db');
    return mockPublicProfile(slug);
  }
  const res = await fetch(serverApiBase() + ENDPOINTS.doctors.bySlug(slug), {
    next: { revalidate: 60, tags: [`doctor:${slug}`] },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Doctor profile request failed with ${res.status}`);
  return DoctorProfileSchema.parse(await res.json());
}
