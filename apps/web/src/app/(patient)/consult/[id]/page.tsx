import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChatView } from '@/components/consult/chat-view';
import { Page } from '@/components/shell/page';
import { getLocale } from '@/i18n/server';
import { getFormConfig } from '@/lib/contract-data';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };

export default async function ChatRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { specialties } = getFormConfig(await getLocale());
  return (
    <Page size="wide" withNav={false} className="max-lg:px-0 max-lg:pb-0 max-lg:pt-0">
      <Suspense>
        <ChatView
          id={id}
          specialties={Object.fromEntries(specialties.map((s) => [s.key, s.label]))}
        />
      </Suspense>
    </Page>
  );
}
