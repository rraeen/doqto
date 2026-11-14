import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LabProfile } from '@/components/labs/lab-profile';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Lab' };

export default async function LabRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Page size="medium">
      <Suspense>
        <LabProfile slug={slug} />
      </Suspense>
    </Page>
  );
}
