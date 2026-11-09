import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecordsPage } from '@/components/records/records-page';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'My health records', robots: { index: false } };

export default function RecordsRoute() {
  return (
    <Page size="wide">
      <Suspense>
        <RecordsPage />
      </Suspense>
    </Page>
  );
}
