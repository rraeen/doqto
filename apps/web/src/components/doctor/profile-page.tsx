'use client';

import { Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/shell/page';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';
import type { FormConfig } from '@/lib/contract-data';
import { useDoctorProfile } from '@/lib/doctor';
import { ProfileEditor } from './profile-editor';

export function DoctorProfilePage({ config }: { config: FormConfig }) {
  const t = useT();
  const gate = useSignedIn('/clinic/profile');
  const doctor = useDoctorProfile();
  if (!gate.me) return gate.node;
  if (doctor.isPending) return <Loading />;
  if (!doctor.data) {
    return (
      <EmptyState
        icon={Stethoscope}
        title={t('doctor.joinTitle')}
        description={t('doctor.joinBody')}
        action={
          <Link href="/clinic/onboarding" className={buttonVariants({ size: 'lg' })}>
            {t('doctor.joinCta')}
          </Link>
        }
      />
    );
  }
  return (
    <>
      <PageTitle>{t('doctor.profileTitle')}</PageTitle>
      {/* Remount when the server copy changes identity so the form starts from saved data. */}
      <ProfileEditor key={doctor.data.id} profile={doctor.data} config={config} />
    </>
  );
}
