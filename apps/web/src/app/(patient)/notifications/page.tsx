import type { Metadata } from 'next';
import { NotificationsPage } from '@/components/notifications/notifications-page';
import { Page } from '@/components/shell/page';
import { RequireSignIn } from '@/components/auth/require-sign-in';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };

export default function Notifications() {
  return (
    <Page size="medium">
      <RequireSignIn>
        <NotificationsPage />
      </RequireSignIn>
    </Page>
  );
}
