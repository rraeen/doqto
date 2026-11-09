'use client';

import { useEffect } from 'react';
import { env } from '@/lib/env';
import { startInstallCapture } from '@/lib/pwa-install';

/**
 * Registers the service worker in production builds. In development (and with API mocks, which
 * have their own worker) any old registration is removed so stale caches never confuse testing.
 */
export function PwaRegister() {
  useEffect(() => {
    startInstallCapture();
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production' || env.apiMocks) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          if (reg.active?.scriptURL.endsWith('/sw.js')) void reg.unregister();
        }
      });
      return;
    }
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
