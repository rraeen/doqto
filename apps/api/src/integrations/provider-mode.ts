/**
 * Demo vs live providers (TDD section 13). The mode is read once from
 * PROVIDER_MODE at startup; nothing at runtime can change it.
 */
export const PROVIDER_MODES = ['demo', 'live'] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

/** Every provider says which mode it implements, so startup checks (INT-03) can verify bindings. */
export interface ProviderInfo {
  /** Stable implementation name, e.g. `demo-otp`, `razorpay`. */
  readonly providerName: string;
  readonly mode: ProviderMode;
}

export function parseProviderMode(value: string | undefined): ProviderMode {
  if (value === 'demo' || value === 'live') return value;
  throw new Error(
    `PROVIDER_MODE must be "demo" or "live" (got ${value === undefined ? 'nothing' : `"${value}"`})`,
  );
}
