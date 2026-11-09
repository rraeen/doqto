import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import { OfflineVisits } from '@/components/pwa/offline-visits';
import { getTranslator } from '@/i18n/server';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Shown by the service worker when a page cannot be loaded. Plain markup: it must work without scripts. */
export default async function OfflinePage() {
  const { t } = await getTranslator();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="neu-card flex size-24 items-center justify-center rounded-full text-brand-600">
        <WifiOff className="size-10" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{t('pwa.offlineTitle')}</h1>
        <p className="mx-auto max-w-sm text-ink-muted">{t('pwa.offlineBody')}</p>
      </div>
      {/* Saved visits show up once scripts load; the page is still fine without them. */}
      <OfflineVisits />
      {/* A plain link on purpose: this page must work when no scripts have loaded. */}
      <a href="/" className="neu-glow rounded-full px-10 py-4 text-lg font-bold">
        {t('pwa.offlineRetry')}
      </a>
    </main>
  );
}
