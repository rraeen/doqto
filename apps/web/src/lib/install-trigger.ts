'use client';

import { useSyncExternalStore } from 'react';

/**
 * The install invitation only appears once the patient has booked a visit: by then they have a
 * reason to keep the app on their home screen (the visit code, the live queue, the reminders).
 */
const KEY = 'doqto-has-booked';
const CHANGED = 'doqto-has-booked-changed';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Remembers that this person has made a booking on this device. */
export function markBooked(): void {
  try {
    if (window.localStorage.getItem(KEY) === '1') return;
    window.localStorage.setItem(KEY, '1');
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode: the invitation just will not appear.
  }
}

export function useHasBooked(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
