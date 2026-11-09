import { OTP_LENGTH } from '@doqto/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginFlow } from '@/components/auth/login-flow';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.audience === 'clinic') {
    // Providers sign in on the console, not on the patient site.
    redirect(`${env.consoleUrl}/login`);
  }
  return (
    <main className="neu-card w-full max-w-[480px] rounded-[2rem] p-8 text-center sm:p-12">
      <Suspense>
        <LoginFlow otpLength={OTP_LENGTH} />
      </Suspense>
    </main>
  );
}
