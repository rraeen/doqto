'use client';

import { useQuery } from '@tanstack/react-query';
import { Loading } from '@/components/shell/signed-in';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';
import { searchApi } from '@/lib/api/lazy';
import { sampleProfileBySlug } from '@/lib/sample-doctors';
import { DoctorProfileView } from './profile-view';

/**
 * Mock mode only: the server cannot see doctors created in this browser's mock store, so the
 * page asks MSW for them before showing "not found". Never rendered against a real API.
 */
export function MockProfileFallback({
  slug,
  specialties,
}: {
  slug: string;
  specialties: Record<string, string>;
}) {
  const t = useT();
  const q = useQuery({
    queryKey: ['public-doctor', slug],
    queryFn: ({ signal }) => searchApi.getDoctorBySlug(slug, signal),
  });
  if (q.isPending) return <Loading />;
  const profile = q.data ?? sampleProfileBySlug(slug);
  if (!profile) {
    return (
      <EmptyState
        title={t('doctorPage.notFoundTitle')}
        description={t('doctorPage.notFoundBody')}
      />
    );
  }
  return <DoctorProfileView profile={profile} t={t} specialties={specialties} photoHost={null} />;
}
