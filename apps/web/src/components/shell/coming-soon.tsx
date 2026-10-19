import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { getTranslator } from '@/i18n/server';
import { Page } from './page';

/** Placeholder for nav destinations whose story has not landed yet. */
export async function ComingSoon({ withNav = true }: { withNav?: boolean }) {
  const { t } = await getTranslator();
  return (
    <Page withNav={withNav}>
      <EmptyState
        icon={Construction}
        title={t('empty.comingSoon')}
        description={t('empty.comingSoonBody')}
      />
    </Page>
  );
}
