import type { Metadata } from 'next';
import { OnboardingPage } from '@/components/doctor/onboarding-page';
import { Page } from '@/components/shell/page';
import { getFormConfig } from '@/lib/contract-data';
import { getLocale } from '@/i18n/server';

export const metadata: Metadata = { title: 'Join as a doctor', robots: { index: false } };

export default async function DoctorOnboardingRoute() {
  return (
    <Page size="medium">
      <OnboardingPage config={getFormConfig(await getLocale())} />
    </Page>
  );
}
