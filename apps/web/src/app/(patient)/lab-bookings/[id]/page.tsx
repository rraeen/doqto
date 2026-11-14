import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LabBookingDetails } from '@/components/labs/lab-booking-details';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Lab booking', robots: { index: false } };

export default async function LabBookingRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page size="medium">
      <Suspense>
        <LabBookingDetails id={id} />
      </Suspense>
    </Page>
  );
}
