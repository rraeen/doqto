import { NAME_MAX } from '@doqto/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileView } from '@/components/profile/profile-view';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Profile', robots: { index: false } };

export default function ProfilePage() {
  return (
    <Page>
      <Suspense>
        <ProfileView nameMax={NAME_MAX} />
      </Suspense>
    </Page>
  );
}
