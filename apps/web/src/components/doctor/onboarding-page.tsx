'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import type { FormConfig } from '@/lib/contract-data';
import { useDoctorProfile } from '@/lib/doctor';
import { OnboardingWizard } from './onboarding-wizard';

export function OnboardingPage({ config }: { config: FormConfig }) {
  const router = useRouter();
  const gate = useSignedIn('/clinic/onboarding');
  const doctor = useDoctorProfile();
  // Set when this wizard saves the last step: it then sends the doctor to /clinic itself.
  const [finishing, setFinishing] = useState(false);
  // A doctor who already finished and opens this page again goes to the profile editor.
  const revisit = !finishing && Boolean(doctor.data && doctor.data.bookingFee !== null);
  useEffect(() => {
    if (revisit) router.replace('/clinic/profile');
  }, [revisit, router]);
  if (!gate.me) return gate.node;
  if (doctor.isPending || revisit) return <Loading />;
  return (
    <OnboardingWizard
      config={config}
      onboarded={Boolean(doctor.data)}
      onFinishing={() => setFinishing(true)}
    />
  );
}
