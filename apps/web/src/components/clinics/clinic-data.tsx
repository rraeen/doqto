'use client';

import type { ClinicPrivate } from '@doqto/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { clinicsApi } from '@/lib/api/lazy';
import { doctorProfileKey } from '@/lib/doctor';

export const myClinicsKey = ['clinics', 'mine'] as const;
export const clinicKey = (id: string) => ['clinic', id] as const;

export function useMyClinics(enabled: boolean) {
  return useQuery({
    queryKey: myClinicsKey,
    queryFn: ({ signal }) => clinicsApi.listMyClinics(signal),
    enabled,
  });
}

/** Keeps the list and detail caches in step after any clinic mutation. */
export function useStoreClinic() {
  const qc = useQueryClient();
  return (c: ClinicPrivate) => {
    qc.setQueryData(clinicKey(c.id), c);
    qc.setQueryData<ClinicPrivate[]>(myClinicsKey, (list) =>
      list
        ? list.some((x) => x.id === c.id)
          ? list.map((x) => (x.id === c.id ? c : x))
          : [...list, c]
        : list,
    );
    // The doctor's checklist ("add a clinic") and listing depend on clinics.
    void qc.invalidateQueries({ queryKey: doctorProfileKey });
  };
}

export function addressLine(c: ClinicPrivate) {
  return [c.address.line1, c.address.area, c.address.city].filter(Boolean).join(', ');
}

export function StickySave({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-20 z-10 [&_button]:shadow-lg">{children}</div>;
}
