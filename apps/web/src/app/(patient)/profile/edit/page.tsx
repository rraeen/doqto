import { NAME_MAX } from '@doqto/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileView } from '@/components/profile/profile-view';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Edit profile', robots: { index: false } };

export default function EditProfilePage() {
  return (
    <Page size="medium">
      <Suspense>
        <ProfileView nameMax={NAME_MAX} mode="edit" />
      </Suspense>
    </Page>
  );
}
