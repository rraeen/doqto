import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LabBookingsPage } from '@/components/labs/lab-bookings-page';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'My lab bookings', robots: { index: false } };

export default function LabBookingsRoute() {
  return (
    <Page size="medium">
      <Suspense>
        <LabBookingsPage />
      </Suspense>
    </Page>
  );
}
