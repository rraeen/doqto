'use client';

import { useSyncExternalStore } from 'react';

const SCROLL_THRESHOLD = 8;

function subscribe(onChange: () => void): () => void {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/** `true` once the page has scrolled past the top. `false` on the server and at the top. */
export function useScrolled(threshold = SCROLL_THRESHOLD): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  );
}
