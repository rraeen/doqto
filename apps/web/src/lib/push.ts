'use client';

import { useSyncExternalStore } from 'react';
import { accountApi } from './api/lazy';

/**
 * Web Push on this device: asks permission, registers the device with Doqto and can show a test
 * alert. WhatsApp stays the guaranteed channel; push is the fast one where the browser allows it
 * (Android Chrome, and iPhone only once Doqto is on the home screen).
 */
const KEY = 'doqto-push';
const CHANGED = 'doqto-push-changed';

/** The public VAPID key from the push provider; without it a device cannot subscribe. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

interface Saved {
  /** Doqto's id for this device's subscription, when it is registered with the server. */
  id: string | null;
}

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(saved: Saved | null): void {
  try {
    if (saved) window.localStorage.setItem(KEY, JSON.stringify(saved));
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode: the switch just will not remember itself.
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

function stateNow(): PushState {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && readSaved() ? 'on' : 'off';
}

export function usePushState(): PushState {
  return useSyncExternalStore(subscribe, stateNow, () => 'unsupported' as PushState);
}

/** The VAPID key as the bytes `PushManager.subscribe` wants. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Turns alerts on: asks the browser for permission and, when a VAPID key is configured, registers
 * the device with Doqto. Without a key (development and demos) it only remembers the choice, and
 * the test alert still works. Returns the resulting state.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  let id: string | null = null;
  if (VAPID_PUBLIC_KEY) {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
      }));
    const json = sub.toJSON();
    if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
      const res = await accountApi.registerPush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      id = res.id;
    }
  }
  write({ id });
  return 'on';
}

export async function disablePush(): Promise<void> {
  const saved = readSaved();
  write(null);
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    if (saved?.id) await accountApi.unregisterPush(saved.id);
  } catch {
    // The device is already off locally; the server prunes dead subscriptions on its own.
  }
}

/** Shows a local alert so the patient can see what a real one looks like. */
export async function showTestAlert(title: string, body: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'doqto-test',
    data: { url: '/appointments' },
  });
}
