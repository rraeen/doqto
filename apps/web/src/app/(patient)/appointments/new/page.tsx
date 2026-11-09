import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingFlow } from '@/components/booking/booking-flow';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Book a visit', robots: { index: false } };

export default async function NewAppointmentRoute() {
  const { specialties } = getFormConfig(await getLocale());
  return (
    <Page size="wide">
      <Suspense>
        <BookingFlow specialties={Object.fromEntries(specialties.map((s) => [s.key, s.label]))} />
      </Suspense>
    </Page>
  );
}
