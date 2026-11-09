import type { IntegrationsConfig } from './integrations.config';

/** Test-only config builder for integrations specs. */
export function testIntegrationsConfig(
  overrides: Partial<IntegrationsConfig> = {},
): IntegrationsConfig {
  return {
    mode: 'demo',
    nodeEnv: 'test',
    mongodbUri: 'mongodb://localhost:27017/?replicaSet=rs0',
    mongodbDbName: 'doqto_demo_test',
    hashPepper: 'test-pepper-0123456789',
    apiPublicUrl: 'http://localhost:4000',
    demoStorageDir: '.demo-storage-test',
    signedUrlTtlSeconds: 300,
    geocoderUserAgent: 'Doqto-test/0.1 (test@doqto.in)',
    whatsapp: { testRecipients: [], sendAsText: false },
    msg91: {},
    razorpay: {},
    r2: {},
    ...overrides,
  };
}
