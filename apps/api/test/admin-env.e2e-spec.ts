import { ApiErrorSchema, ConsoleSessionSchema } from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import request from 'supertest';

const BASE_ENV = { ...process.env };

/**
 * ConfigModule validates the environment when AppModule is first imported, so each boot loads the
 * app fresh (jest.isolateModules) under the env it is given. Nest writes the validated values back
 * to process.env (a number for a duration, for example), which would not validate again, so every
 * boot starts from the original environment.
 */
async function boot(env: Record<string, string>): Promise<INestApplication> {
  process.env = { ...BASE_ENV, ...env };
  let create!: () => Promise<INestApplication>;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');
    /* eslint-enable @typescript-eslint/no-require-imports */
    create = async () => {
      const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const app = ref.createNestApplication({ bufferLogs: true, rawBody: true });
      configureApp(app);
      await app.listen(0);
      return app;
    };
  });
  return create();
}

let n = 0;
const login = (app: INestApplication, identifier: string, password: string) =>
  request(app.getHttpServer())
    .post('/api/v1/console/auth/login')
    .set('X-Forwarded-For', `10.50.0.${++n}`)
    .send({ identifier, password });
const connection = (app: INestApplication) => app.get<Connection>(getConnectionToken());

describe('admin login from .env (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)', () => {
  afterAll(() => {
    process.env = { ...BASE_ENV };
  });

  it('creates the account at start, and a changed password or email takes effect after a restart', async () => {
    const first = await boot({
      ADMIN_EMAIL: 'Boss@Example.com',
      ADMIN_PASSWORD: 'First-password-1',
      ADMIN_NAME: 'The Boss',
    });
    try {
      // The email is not case sensitive; the name comes from .env.
      const ok = await login(first, 'boss@example.com', 'First-password-1').expect(200);
      expect(ConsoleSessionSchema.parse(ok.body).account).toMatchObject({ name: 'The Boss', platformRole: 'admin', workspaces: [] });
      await login(first, 'boss@example.com', 'Wrong-password-1').expect(401);
    } finally {
      await first.close();
    }

    // Change the password and name in .env and restart: the old password stops working.
    const second = await boot({
      ADMIN_EMAIL: 'boss@example.com',
      ADMIN_PASSWORD: 'Second-password-2',
      ADMIN_NAME: 'Renamed Boss',
    });
    try {
      await login(second, 'boss@example.com', 'First-password-1').expect(401);
      const ok = await login(second, 'boss@example.com', 'Second-password-2').expect(200);
      expect(ConsoleSessionSchema.parse(ok.body).account.name).toBe('Renamed Boss');
      expect(
        await connection(second).collection('accounts').countDocuments({ email: 'boss@example.com' }),
      ).toBe(1);
    } finally {
      await second.close();
    }

    // A new email makes a second admin; the first one keeps working.
    const third = await boot({ ADMIN_EMAIL: 'other@example.com', ADMIN_PASSWORD: 'Third-password-3' });
    try {
      await login(third, 'other@example.com', 'Third-password-3').expect(200);
      await login(third, 'boss@example.com', 'Second-password-2').expect(200);
    } finally {
      await connection(third).dropDatabase();
      await third.close();
    }
  });

  it('refuses to start with a weak password or a bad email', async () => {
    await expect(
      boot({ ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'short' }),
    ).rejects.toThrow(/ADMIN_PASSWORD/);
    await expect(
      boot({ ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD: 'Good-password-1' }),
    ).rejects.toThrow(/ADMIN_EMAIL/);
  });

  it('does nothing when they are empty', async () => {
    const app = await boot({ ADMIN_EMAIL: '', ADMIN_PASSWORD: '' });
    try {
      expect(
        await connection(app).collection('accounts').countDocuments({ platformRole: 'admin' }),
      ).toBe(0);
      const res = await login(app, 'nobody@example.com', 'Whatever-123').expect(401);
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('INVALID_CREDENTIALS');
    } finally {
      await connection(app).dropDatabase();
      await app.close();
    }
  });
});
