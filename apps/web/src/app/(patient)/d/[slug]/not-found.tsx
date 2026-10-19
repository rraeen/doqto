import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/components/shell/page';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getTranslator } from '@/i18n/server';

export default async function DoctorNotFound() {
  const { t } = await getTranslator();
  return (
    <Page>
      <EmptyState
        icon={SearchX}
        title={t('doctorPage.notFoundTitle')}
        description={t('doctorPage.notFoundBody')}
        action={
          <Link href="/search" className={buttonVariants({ size: 'lg' })}>
            {t('nav.search')}
          </Link>
        }
      />
    </Page>
  );
}
