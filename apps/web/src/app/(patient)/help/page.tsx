import type { Metadata } from 'next';
import { HelpView } from '@/components/help/help-view';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Help' };

export default function HelpPage() {
  return (
    <Page size="medium">
      <HelpView />
    </Page>
  );
}
