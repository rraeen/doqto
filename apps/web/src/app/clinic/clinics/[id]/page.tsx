import type { Metadata } from 'next';
import { ClinicDetailPage } from '@/components/clinics/clinic-detail';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Clinic', robots: { index: false } };

export default async function ClinicRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page size="medium">
      <ClinicDetailPage id={id} config={getFormConfig(await getLocale())} />
    </Page>
  );
}
