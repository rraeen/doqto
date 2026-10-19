'use client';

import type { DoctorPrivateProfile } from '@doqto/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorApi } from './api/lazy';
import { useMe } from './session';

export const doctorProfileKey = ['doctor-profile'] as const;

/** The signed-in user's doctor profile: `null` if they have not onboarded, `undefined` while loading. */
export function useDoctorProfile() {
  const me = useMe();
  return useQuery({
    queryKey: doctorProfileKey,
    queryFn: ({ signal }) => doctorApi.getDoctorProfile(signal),
    enabled: Boolean(me.data),
  });
}

export function useSetDoctorProfile() {
  const qc = useQueryClient();
  return (profile: DoctorPrivateProfile) => qc.setQueryData(doctorProfileKey, profile);
}
