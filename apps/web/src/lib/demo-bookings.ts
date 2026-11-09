'use client';

import { useSyncExternalStore } from 'react';
import type { AppointmentStatus } from '@doqto/shared';
import type { AppointmentCardData } from './appointments-view';

const KEY = 'doqto-demo-bookings';
const CHANGED = 'doqto-demo-bookings-changed';
const NONE: AppointmentCardData[] = [];

/** Bookings saved before doctors had an id carry only a slug; use it so the card still works. */
function withDoctorId(a: AppointmentCardData): AppointmentCardData {
  return a.doctor.id ? a : { ...a, doctor: { ...a.doctor, id: a.doctor.slug } };
}

let cachedRaw: string | null | undefined;
let cached: AppointmentCardData[] = NONE;

/** Parsed bookings; the same array comes back until the stored text changes. */
function snapshot(): AppointmentCardData[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return NONE;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as AppointmentCardData[]).map(withDoctorId) : NONE;
    } catch {
      cached = NONE;
    }
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Remembers a booking made in the demo, since there is no booking API yet. */
export function saveDemoBooking(booking: AppointmentCardData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...snapshot(), booking]));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode or full storage: the booking just will not be remembered.
  }
}

export function useDemoBookings(enabled: boolean): AppointmentCardData[] {
  return useSyncExternalStore(
    subscribe,
    () => (enabled ? snapshot() : NONE),
    () => NONE,
  );
}

/** A change the patient made to a demo or example booking (cancelled, or moved to a new time). */
export interface DemoChange {
  status?: AppointmentStatus;
  start?: string;
  holdExpiresAt?: string | null;
  visitCode?: string;
}

const CHANGES_KEY = 'doqto-demo-booking-changes';
const NO_CHANGES: Record<string, DemoChange> = {};
let changesRaw: string | null | undefined;
let changes: Record<string, DemoChange> = NO_CHANGES;

function changesSnapshot(): Record<string, DemoChange> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CHANGES_KEY);
  } catch {
    return NO_CHANGES;
  }
  if (raw !== changesRaw) {
    changesRaw = raw;
    try {
      changes = raw ? (JSON.parse(raw) as Record<string, DemoChange>) : NO_CHANGES;
    } catch {
      changes = NO_CHANGES;
    }
  }
  return changes;
}

/** Remembers a change to a demo booking, since there is no booking API in demo mode. */
export function changeDemoBooking(id: string, change: DemoChange): void {
  try {
    window.localStorage.setItem(
      CHANGES_KEY,
      JSON.stringify({ ...changesSnapshot(), [id]: { ...changesSnapshot()[id], ...change } }),
    );
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode or full storage: the change just will not be remembered.
  }
}

export function useDemoChanges(enabled: boolean): Record<string, DemoChange> {
  return useSyncExternalStore(
    subscribe,
    () => (enabled ? changesSnapshot() : NO_CHANGES),
    () => NO_CHANGES,
  );
}
