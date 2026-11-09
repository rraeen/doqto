import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReviewPage } from '@/components/reviews/review-page';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Rate your visit', robots: { index: false } };

export default async function ReviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page size="medium">
      <Suspense>
        <ReviewPage appointmentId={id} />
      </Suspense>
    </Page>
  );
}
