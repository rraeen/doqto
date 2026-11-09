'use client';

import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useT } from '@/i18n/provider';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** A slim bar that appears while the phone has no connection. */
export function OfflineBanner() {
  const t = useT();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-danger-bg px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-xs font-semibold text-danger"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {t('common.offline')}
    </div>
  );
}
