import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationForm } from '@/components/apply/application-form';

export const metadata: Metadata = { title: 'Apply for a service' };

export default function ApplyPage() {
  // useSearchParams needs a Suspense boundary in a statically rendered page.
  return (
    <Suspense>
      <ApplicationForm />
    </Suspense>
  );
}
