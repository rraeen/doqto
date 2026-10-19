import type { Metadata } from 'next';
import { AdminDoctorPage } from '@/components/admin/admin-doctor';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { specialtyLabels } from '@/lib/contract-data';

export const metadata: Metadata = {
  title: 'Review doctor',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default async function AdminDoctorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Page withNav={false}>
      <AdminDoctorPage id={id} specialties={specialtyLabels(await getLocale())} />
    </Page>
  );
}
