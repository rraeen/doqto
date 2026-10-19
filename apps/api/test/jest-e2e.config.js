/**
 * e2e tests boot the whole Nest app against an in-memory MongoDB replica set
 * (mongodb-memory-server). Set MONGOMS_SYSTEM_BINARY to use a local mongod instead of a download.
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: { '^@doqto/shared$': '<rootDir>/../../../packages/shared/src/index.ts' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/setup-env.ts'],
  globalSetup: '<rootDir>/global-setup.ts',
  globalTeardown: '<rootDir>/global-teardown.ts',
};
