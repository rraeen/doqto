/**
 * INT-03 / TDD 13 rule 2, end to end: the real AppModule refuses demo mode on a production
 * database. (Booting on a doqto_demo* database is covered by every other e2e file.)
 */
describe('demo-mode startup safety', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('fails to boot with PROVIDER_MODE=demo and MONGODB_DB_NAME=doqto_prod', async () => {
    process.env.PROVIDER_MODE = 'demo';
    process.env.MONGODB_DB_NAME = 'doqto_prod';
    // ConfigModule validates when AppModule is loaded, so load it (and Nest) fresh under this env.
    let compile: (() => Promise<unknown>) | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
      compile = () => Test.createTestingModule({ imports: [AppModule] }).compile();
    });
    await expect(compile!()).rejects.toThrow(/Refusing to start[\s\S]*doqto_prod/);
  });
});
