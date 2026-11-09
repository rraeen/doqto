import type { Metadata } from 'next';
import { DoctorProfilePage } from '@/components/doctor/profile-page';
import { Page } from '@/components/shell/page';
import { getFormConfig } from '@/lib/contract-data';
import { getLocale } from '@/i18n/server';

export const metadata: Metadata = { title: 'Doctor profile', robots: { index: false } };

export default async function DoctorProfileRoute() {
  return (
    <Page size="medium">
      <DoctorProfilePage config={getFormConfig(await getLocale())} />
    </Page>
  );
}
