import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingConfirm } from '@/components/booking/booking-confirm';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Confirm your visit', robots: { index: false } };

export default async function ConfirmRoute() {
  const { specialties } = getFormConfig(await getLocale());
  return (
    <Page size="wide">
      <Suspense>
        <BookingConfirm
          specialties={Object.fromEntries(specialties.map((s) => [s.key, s.label]))}
        />
      </Suspense>
    </Page>
  );
}
