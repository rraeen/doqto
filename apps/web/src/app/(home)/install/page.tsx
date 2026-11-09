import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { InstallGuide } from '@/components/pwa/install-guide';
import { PublicFooter, PublicNav } from '@/components/landing/public-nav';
import { getTranslator } from '@/i18n/server';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Install Doqto on your phone for one-tap access and a full-screen app.',
};

export default async function InstallPage() {
  const { t } = await getTranslator();
  const benefits = [t('install.benefit1'), t('install.benefit2'), t('install.benefit3')];
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pb-20 pt-32 sm:px-6 sm:pt-40">
        <header className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={112}
            height={112}
            priority
            className="size-28 rounded-[28%] shadow-[10px_10px_24px_#bcc7bc,-10px_-10px_24px_#ffffff]"
          />
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {t('install.title')}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-ink-muted">{t('install.subtitle')}</p>
          </div>
          <ul className="space-y-2 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 font-medium text-ink">
                <Check className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </header>
        <InstallGuide />
      </main>
      <PublicFooter />
    </div>
  );
}
