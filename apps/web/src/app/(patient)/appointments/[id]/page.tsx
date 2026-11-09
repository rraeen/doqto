import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppointmentDetails } from '@/components/appointments/appointment-details';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Visit details', robots: { index: false } };

export default async function AppointmentDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Page size="medium">
      <Suspense>
        <AppointmentDetails id={id} />
      </Suspense>
    </Page>
  );
}
