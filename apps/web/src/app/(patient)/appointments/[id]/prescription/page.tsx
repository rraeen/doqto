import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PrescriptionView } from '@/components/appointments/prescription-view';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Prescription details', robots: { index: false } };

export default async function PrescriptionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page size="wide">
      <Suspense>
        <PrescriptionView id={id} />
      </Suspense>
    </Page>
  );
}
