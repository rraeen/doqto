import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPage } from '@/components/search/search-page';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Find a doctor' };

function photoHost(): string | null {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname : null;
  } catch {
    return null;
  }
}

export default async function SearchRoute() {
  const { specialties } = getFormConfig(await getLocale());
  return (
    <Page>
      <Suspense>
        <SearchPage specialties={specialties} photoHost={photoHost()} />
      </Suspense>
    </Page>
  );
}
