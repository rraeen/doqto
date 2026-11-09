'use client';

import type { MyReview, PublicReview } from '@doqto/shared';
import { useSyncExternalStore } from 'react';

/** A review written in demo mode, with the doctor it is about. */
export interface DemoReview {
  review: MyReview;
  doctorSlug: string;
  reviewerName: string;
  /** `YYYY-MM` of the visit. */
  visitMonth: string;
}

const KEY = 'doqto-demo-reviews';
const CHANGED = 'doqto-demo-reviews-changed';
const NONE: Record<string, DemoReview> = {};

let cachedRaw: string | null | undefined;
let cached: Record<string, DemoReview> = NONE;

function snapshot(): Record<string, DemoReview> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return NONE;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Record<string, DemoReview>) : NONE;
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

/** Reviews written in this browser, by appointment id. */
export function useDemoReviews(enabled: boolean): Record<string, DemoReview> {
  return useSyncExternalStore(
    subscribe,
    () => (enabled ? snapshot() : NONE),
    () => NONE,
  );
}

export function saveDemoReview(appointmentId: string, entry: DemoReview): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...snapshot(), [appointmentId]: entry }));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Private mode or full storage: the review just will not be remembered.
  }
}

/**
 * The stand-in for the fraud scorer: a review that hands out a phone number or a link is held
 * for checking instead of being published straight away. The real scorer is on the server.
 */
export function looksRisky(text: string | undefined | null): boolean {
  if (!text) return false;
  return /https?:\/\/|www\./i.test(text) || /\d{8,}/.test(text.replace(/[\s-]/g, ''));
}

/** A demo review as the public list shows it. */
export function toPublicReview(entry: DemoReview): PublicReview {
  const r = entry.review;
  return {
    id: r.id,
    reviewerName: entry.reviewerName,
    ratings: r.ratings,
    wouldRecommend: r.wouldRecommend,
    reason: r.reason,
    text: r.text,
    visitMonth: entry.visitMonth,
    earlierVisit: false,
    reply: null,
    publishedAt: r.submittedAt,
  };
}
