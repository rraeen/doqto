import type { Metadata } from 'next';
import { NewClinicPage } from '@/components/clinics/clinic-new';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Add clinic', robots: { index: false } };

export default function NewClinicRoute() {
  return (
    <Page>
      <NewClinicPage />
    </Page>
  );
}
