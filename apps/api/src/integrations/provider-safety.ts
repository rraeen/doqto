import type { IntegrationsConfig } from './integrations.config';
import type { ProviderInfo } from './provider-mode';

/**
 * TDD 13 safety rules. A fixed OTP means anyone can log in as anyone, so demo
 * mode must never touch production data, and live mode must never run a demo
 * provider. Checked once when Nest instantiates IntegrationsModule, before the
 * API listens; a failure stops startup.
 */
export class UnsafeProviderConfigError extends Error {
  constructor(problems: string[]) {
    super(`Refusing to start (TDD 13 demo safety):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'UnsafeProviderConfigError';
  }
}

export const DEMO_DB_PREFIX = 'doqto_demo';

/** Database name in the URI path, if any (`mongodb://host/doqto_prod?x` -> `doqto_prod`). */
export function databaseNameFromUri(uri: string): string | undefined {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]*\/([^?]*)/.exec(uri);
  const name = match?.[1] ? decodeURIComponent(match[1]) : '';
  return name || undefined;
}

const looksLikeProduction = (dbName: string): boolean => /prod/i.test(dbName);

export type SafetyInput = Pick<
  IntegrationsConfig,
  'mode' | 'nodeEnv' | 'mongodbUri' | 'mongodbDbName'
>;

/** Returns every problem found; empty means safe. */
export function providerSafetyProblems(
  config: SafetyInput,
  bound: readonly ProviderInfo[],
): string[] {
  const problems: string[] = [];
  const dbName = config.mongodbDbName;

  if (config.mode === 'demo') {
    if (!dbName.startsWith(DEMO_DB_PREFIX)) {
      problems.push(
        `PROVIDER_MODE=demo needs a database named ${DEMO_DB_PREFIX}* (MONGODB_DB_NAME is "${dbName}")`,
      );
    }
    const uriDb = databaseNameFromUri(config.mongodbUri);
    if (uriDb !== undefined && !uriDb.startsWith(DEMO_DB_PREFIX)) {
      problems.push(`PROVIDER_MODE=demo but MONGODB_URI points at database "${uriDb}"`);
    }
    if (config.nodeEnv === 'production' && [dbName, uriDb ?? ''].some(looksLikeProduction)) {
      problems.push('PROVIDER_MODE=demo with NODE_ENV=production and a production database name');
    }
  }

  if (config.mode === 'live') {
    const demo = bound.filter((p) => p.mode !== 'live').map((p) => p.providerName);
    if (demo.length > 0) {
      problems.push(`PROVIDER_MODE=live but demo providers are bound: ${demo.join(', ')}`);
    }
  }

  return problems;
}

export function assertProviderSafety(config: SafetyInput, bound: readonly ProviderInfo[]): void {
  const problems = providerSafetyProblems(config, bound);
  if (problems.length > 0) throw new UnsafeProviderConfigError(problems);
}
