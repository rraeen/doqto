'use client';

import { Download, Share, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { useHasBooked } from '@/lib/install-trigger';
import { usePwaInstall } from '@/lib/pwa-install';

const DISMISSED_KEY = 'doqto-install-dismissed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISSED_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

const noSubscribe = () => () => undefined;

/**
 * Invites people to add Doqto to their home screen. Chrome and Edge on Android give us an install
 * event; iPhones have no such event, so Safari users get a short how-to instead.
 */
export function InstallPrompt() {
  const t = useT();
  const install = usePwaInstall();
  const asleep = useSyncExternalStore(noSubscribe, snoozed, () => true);
  // Only after a first booking: that is when the app has something worth keeping close.
  const booked = useHasBooked();
  const [closed, setClosed] = useState(false);

  const dismiss = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private mode: it will simply ask again next visit.
    }
  };

  const showIos = install.ios && !install.installed;
  const showInstall = install.canPrompt && !install.installed;
  if (!booked || closed || asleep || (!showIos && !showInstall)) return null;

  return (
    <aside
      role="dialog"
      aria-label={t(showIos ? 'pwa.iosTitle' : 'pwa.installTitle')}
      className="neu-card fixed inset-x-3 bottom-28 z-40 mx-auto flex max-w-md items-start gap-4 rounded-2xl p-4 md:bottom-6"
    >
      <span className="neu-glow flex size-11 shrink-0 items-center justify-center rounded-xl">
        {showIos ? (
          <Share className="size-5" aria-hidden />
        ) : (
          <Download className="size-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{t(showIos ? 'pwa.iosTitle' : 'pwa.installTitle')}</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          {t(showIos ? 'pwa.iosBody' : 'pwa.installBody')}
        </p>
        <div className="mt-3 flex items-center gap-3">
          {showInstall ? (
            <Button type="button" size="sm" className="px-5" onClick={() => void install.prompt()}>
              {t('pwa.install')}
            </Button>
          ) : (
            <Link href="/install" className={buttonVariants({ size: 'sm', className: 'px-5' })}>
              {t('landing.navApp')}
            </Link>
          )}
          <Button type="button" size="sm" variant="ghost" className="px-4" onClick={dismiss}>
            {t('pwa.dismiss')}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.dismiss')}
        className="-m-1 rounded-full p-1 text-ink-muted hover:text-ink"
      >
        <X className="size-5" aria-hidden />
      </button>
    </aside>
  );
}
