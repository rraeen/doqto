import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConsultList } from '@/components/consult/consult-list';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };

export default async function ConsultRoute() {
  const { specialties } = getFormConfig(await getLocale());
  return (
    <Page size="wide">
      <Suspense>
        <ConsultList specialties={Object.fromEntries(specialties.map((s) => [s.key, s.label]))} />
      </Suspense>
    </Page>
  );
}
