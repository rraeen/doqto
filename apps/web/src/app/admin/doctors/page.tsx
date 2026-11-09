import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminQueuePage } from '@/components/admin/admin-queue';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { specialtyLabels } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Doctor verification', robots: { index: false } };

export default async function AdminDoctorsRoute() {
  const specialties = specialtyLabels(await getLocale());
  return (
    <Page withNav={false} size="wide">
      <Suspense>
        <AdminQueuePage specialties={specialties} />
      </Suspense>
    </Page>
  );
}
