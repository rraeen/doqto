import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppointmentsPage } from '@/components/appointments/appointments-page';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'My appointments', robots: { index: false } };

export default function AppointmentsRoute() {
  return (
    <Page size="wide">
      <Suspense>
        <AppointmentsPage />
      </Suspense>
    </Page>
  );
}
