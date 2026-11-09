'use client';

import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
}

/**
 * The current time, rounded down to the minute. It is `0` while rendering on the server and
 * during hydration, so server and browser agree; callers treat `0` as "not ready yet".
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => 0,
  );
}
