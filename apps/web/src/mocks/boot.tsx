'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { env } from '@/lib/env';

/**
 * When NEXT_PUBLIC_API_MOCKS=true, starts the MSW service worker before rendering children,
 * so the first API call is already intercepted. The mock code is loaded only in that case.
 */
export function MockBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!env.apiMocks);
  useEffect(() => {
    if (!env.apiMocks) return;
    let cancelled = false;
    void import('./browser')
      .then(({ startMockWorker }) => startMockWorker())
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready ? children : null;
}
