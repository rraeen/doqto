import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

let started: Promise<void> | null = null;

/**
 * Starts the worker once per page. React Strict Mode runs effects twice in development, and a
 * second worker would run every handler twice (two doctors from one onboarding request).
 */
export function startMockWorker(): Promise<void> {
  started ??= setupWorker(...handlers)
    .start({
      // Next.js assets, fonts and HMR are not API calls.
      onUnhandledFrame: 'bypass',
      quiet: true,
    })
    .then(() => undefined);
  return started;
}
