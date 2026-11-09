import { OTP_LENGTH } from '@doqto/shared';
import { Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginFlow } from '@/components/auth/login-flow';
import { getTranslator } from '@/i18n/server';

export const metadata: Metadata = { title: 'Clinic console sign in', robots: { index: false } };

export default async function ConsoleLoginPage() {
  const { t } = await getTranslator();
  return (
    <main className="neu-card w-full max-w-[480px] rounded-[2rem] p-8 sm:p-12">
      <div className="mb-6 flex justify-center">
        <span className="neu-inset flex size-16 items-center justify-center rounded-full text-brand-600">
          <Stethoscope className="size-8" aria-hidden />
        </span>
      </div>
      <div className="text-center">
        <Suspense>
          <LoginFlow otpLength={OTP_LENGTH} audience="clinic" />
        </Suspense>
      </div>

      <div className="mt-10 text-center">
        <div className="mb-6 flex items-center gap-4">
          <span aria-hidden className="h-px flex-1 bg-line" />
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
            {t('consoleLogin.or')}
          </span>
          <span aria-hidden className="h-px flex-1 bg-line" />
        </div>
        <p className="mb-5 text-sm font-medium text-ink-muted">
          {t('consoleLogin.partnerPrompt')}{' '}
          <Link href="/for-doctors#connect" className="font-bold text-brand-700 hover:underline">
            {t('consoleLogin.partnerCta')}
          </Link>
        </p>
        <p className="mb-3 text-sm font-medium text-ink-muted">{t('consoleLogin.patientPrompt')}</p>
        <Link
          href="/login"
          className="neu-raised flex h-14 items-center justify-center rounded-full px-6 font-bold text-ink hover:brightness-105"
        >
          {t('consoleLogin.patientCta')}
        </Link>
      </div>
    </main>
  );
}
