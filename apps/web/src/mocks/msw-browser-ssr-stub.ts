// `msw/browser` has no server build. The server bundle resolves it here instead (next.config.ts);
// it is never called there because mocks start in a browser-only effect.
export function setupWorker(): never {
  throw new Error('msw/browser is browser-only');
}
