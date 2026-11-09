import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileSettings } from '@/components/profile/profile-settings';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

export default function SettingsPage() {
  return (
    <Page size="medium">
      <Suspense>
        <ProfileSettings />
      </Suspense>
    </Page>
  );
}
