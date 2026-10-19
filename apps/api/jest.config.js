/** Unit tests: src/**\/*.spec.ts. e2e tests live in test/ (see test/jest-e2e.config.js). */
module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: { '^@doqto/shared$': '<rootDir>/../../../packages/shared/src/index.ts' },
};
