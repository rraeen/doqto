import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LabsPage } from '@/components/labs/labs-page';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Lab tests' };

export default function LabsRoute() {
  return (
    <Page size="wide">
      <Suspense>
        <LabsPage />
      </Suspense>
    </Page>
  );
}
