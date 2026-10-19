import { OTP_LENGTH } from '@doqto/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginFlow } from '@/components/auth/login-flow';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <Page withNav={false}>
      <Suspense>
        <LoginFlow otpLength={OTP_LENGTH} />
      </Suspense>
    </Page>
  );
}
