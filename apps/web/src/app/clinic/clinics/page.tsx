import type { Metadata } from 'next';
import { ClinicListPage } from '@/components/clinics/clinic-list';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Your clinics', robots: { index: false } };

export default function ClinicsRoute() {
  return (
    <Page>
      <ClinicListPage />
    </Page>
  );
}
