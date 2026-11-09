'use client';

import { useSyncExternalStore } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Starts listening for the browser's install event. The event fires once, early, so this runs from
 * the root layout; the install page then finds the saved event when it opens.
 */
export function startInstallCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** A stable string describing this device, so React can tell when anything changed. */
function snapshot(): string {
  const flags: string[] = [];
  if (deferred) flags.push('prompt');
  if (installed || isStandalone()) flags.push('installed');
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) flags.push('ios');
  else if (/android/i.test(navigator.userAgent)) flags.push('android');
  if (window.isSecureContext) flags.push('secure');
  return flags.join(' ');
}

function subscribe(onChange: () => void): () => void {
  startInstallCapture();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export interface PwaInstall {
  /** The browser can show its install dialog right now. */
  canPrompt: boolean;
  installed: boolean;
  ios: boolean;
  android: boolean;
  /** https or localhost: the only places a browser offers a full install. */
  secure: boolean;
  /** Shows the install dialog; resolves to what the person chose. */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  emit();
  return choice.outcome;
}

export function usePwaInstall(): PwaInstall {
  const state = useSyncExternalStore(subscribe, snapshot, () => '');
  const has = (flag: string) => state.split(' ').includes(flag);
  return {
    canPrompt: has('prompt'),
    installed: has('installed'),
    ios: has('ios'),
    android: has('android'),
    secure: has('secure'),
    prompt: promptInstall,
  };
}
