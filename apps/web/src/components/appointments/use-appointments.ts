'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import {
  sampleAppointments,
  useMyAppointments,
  type AppointmentCardData,
} from '@/lib/appointments-view';
import { useDemoBookings, useDemoChanges } from '@/lib/demo-bookings';
import { env } from '@/lib/env';
import { markBooked } from '@/lib/install-trigger';
import { clearOfflineVisits, offlineVisitsFrom, saveOfflineVisits } from '@/lib/offline-card';
import { useMe } from '@/lib/session';

/**
 * The signed-in patient's appointments. In demo and local builds, example rows fill an empty list
 * so the screens can be reviewed; `?sample=0` turns them off.
 */
export function useAppointments() {
  const me = useMe();
  const params = useSearchParams();
  const list = useMyAppointments({ enabled: Boolean(me.data) });
  const preview =
    !env.bookingApi &&
    (env.demoMode || process.env.NODE_ENV !== 'production') &&
    params.get('sample') !== '0';
  const sample = preview && (list.data?.length ?? 0) === 0;
  const demoBookings = useDemoBookings(preview);
  const changes = useDemoChanges(preview);
  const all: AppointmentCardData[] = useMemo(
    () =>
      [...(sample ? sampleAppointments() : (list.data ?? [])), ...demoBookings].map((a) =>
        changes[a.id] ? { ...a, ...changes[a.id] } : a,
      ),
    [sample, list.data, demoBookings, changes],
  );

  // The next visits are kept on this phone for the offline page; a signed-out phone keeps none.
  const signedIn = Boolean(me.data);
  const loaded = !me.isPending && !(signedIn && list.isPending);
  useEffect(() => {
    if (me.isPending) return;
    if (!signedIn) {
      clearOfflineVisits();
      return;
    }
    if (!loaded) return;
    saveOfflineVisits(offlineVisitsFrom(all));
    if (all.some((a) => !a.id.startsWith('sample-'))) markBooked();
  }, [all, signedIn, loaded, me.isPending]);
  return {
    me,
    preview,
    /** Booking works: through the API, or against the demo store. */
    bookable: env.bookingApi || preview,
    all,
    sample,
    isPending: me.isPending || Boolean(me.data && list.isPending),
  };
}
