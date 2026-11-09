'use client';

import type { DoctorListItem, DoctorProfile } from '@doqto/shared';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from './api/lazy';
import { env } from './env';
import { SAMPLE_DOCTORS } from './sample-doctors';

/** The pilot city whose doctors the booking screens list. */
export const BOOKING_CITY = 'Bareilly';

/**
 * Doctors a patient can book. With `NEXT_PUBLIC_BOOKING_API` on they are the real, listed doctors
 * from the API (each with its id and clinic, which a booking needs); otherwise the demo examples.
 */
export function useBookableDoctors(opts: { allCities?: boolean } = {}): {
  doctors: DoctorListItem[];
  isPending: boolean;
} {
  const city = opts.allCities ? undefined : BOOKING_CITY;
  const query = useQuery({
    queryKey: ['bookable-doctors', city ?? 'all'],
    queryFn: async ({ signal }) =>
      (await searchApi.searchDoctors(city ? { city, limit: 50 } : { limit: 50 }, signal)).items,
    enabled: env.bookingApi,
    staleTime: 60_000,
  });
  if (!env.bookingApi) return { doctors: SAMPLE_DOCTORS, isPending: false };
  return { doctors: query.data ?? [], isPending: query.isPending };
}

/** A profile as a list item, so one doctor looked up by id can use the screens built for lists. */
export function profileToListItem(p: DoctorProfile): DoctorListItem {
  const clinic = p.clinics[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    photoUrl: p.photoUrl,
    specialties: p.specialties,
    experienceYears: p.experienceYears,
    city: p.city,
    consultFee: p.consultFee,
    ratingSummary: p.ratingSummary,
    distanceMeters: null,
    primaryClinic: clinic
      ? { id: clinic.id, name: clinic.name, area: clinic.address.area ?? null }
      : null,
  };
}

/**
 * One doctor, found by their unique id (a slug also works for old links). Booking links carry the
 * id, so the booking screens show exactly that doctor even when several share a name.
 */
export function useDoctorById(wanted: string | null): {
  doctor: DoctorListItem | null;
  isPending: boolean;
} {
  const sample = wanted
    ? (SAMPLE_DOCTORS.find((d) => d.id === wanted || d.slug === wanted) ?? null)
    : null;
  const query = useQuery({
    queryKey: ['doctor-by-id', wanted],
    queryFn: async ({ signal }) => {
      const profile = await searchApi.getDoctorBySlug(wanted as string, signal);
      return profile ? profileToListItem(profile) : null;
    },
    enabled: Boolean(wanted) && (env.bookingApi || !sample),
    staleTime: 60_000,
  });
  if (!wanted) return { doctor: null, isPending: false };
  if (!env.bookingApi && sample) return { doctor: sample, isPending: false };
  return { doctor: query.data ?? null, isPending: query.isPending };
}
