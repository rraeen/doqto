'use client';

import { appointmentReference } from '@doqto/shared';
import { useSyncExternalStore } from 'react';
import type { AppointmentCardData } from './appointments-view';

/**
 * The next visits, kept on this phone so the visit code and time can be shown with no network
 * (the offline page reads this). It holds only what the front desk asks for, never anything
 * clinical, and is wiped when the patient signs out or deletes their account.
 */
export interface OfflineVisit {
  id: string;
  reference: string;
  doctor: string;
  specialty: string;
  clinic: string;
  /** ISO time of the slot, or `null`. */
  start: string | null;
  status: AppointmentCardData['status'];
  /** The 4-digit code, once the doctor has confirmed. */
  visitCode: string | null;
}

const KEY = 'doqto-offline-visits';
const CHANGED = 'doqto-offline-visits-changed';
const NONE: OfflineVisit[] = [];
const MAX_VISITS = 5;

const KEEP = new Set(['pending_confirmation', 'confirmed', 'checked_in', 'in_consult']);

/** The visits worth keeping offline: real bookings that are paid and still to come. */
export function offlineVisitsFrom(all: readonly AppointmentCardData[]): OfflineVisit[] {
  return all
    .filter((a) => KEEP.has(a.status) && !a.id.startsWith('sample-'))
    .sort((a, b) => (a.start ? Date.parse(a.start) : 0) - (b.start ? Date.parse(b.start) : 0))
    .slice(0, MAX_VISITS)
    .map((a) => ({
      id: a.id,
      reference: appointmentReference(a.id),
      doctor: a.doctor.name,
      specialty: a.doctor.specialty,
      clinic: [a.clinic.name, a.clinic.area].filter(Boolean).join(', '),
      start: a.start,
      status: a.status,
      visitCode: a.visitCode ?? null,
    }));
}

let cachedRaw: string | null | undefined;
let cached: OfflineVisit[] = NONE;

function snapshot(): OfflineVisit[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return NONE;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as OfflineVisit[]) : NONE;
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

/** Keeps the saved visits in step with the list; writes only when something changed. */
export function saveOfflineVisits(visits: OfflineVisit[]): void {
  try {
    const next = visits.length ? JSON.stringify(visits) : null;
    if (next === window.localStorage.getItem(KEY)) return;
    if (next === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode or full storage: the offline card just will not be there.
  }
}

/** Wipes the saved visits: on sign-out and when an account is deleted. */
export function clearOfflineVisits(): void {
  saveOfflineVisits([]);
}

export function useOfflineVisits(): OfflineVisit[] {
  return useSyncExternalStore(subscribe, snapshot, () => NONE);
}
