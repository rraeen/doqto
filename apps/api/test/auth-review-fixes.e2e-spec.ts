import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import request from 'supertest';
import { createTestApp } from './app';
import { login } from './helpers';

/** RD BE-04 should-fix 2: parallel refreshes (two tabs) must not log the user out. */
describe('refresh races', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  const refresh = (token: string) =>
    http()
      .post('/api/v1/auth/refresh')
      .set('X-Doqto-Client', 'mobile')
      .send({ refreshToken: token });

  it('the losing tab gets REFRESH_INVALID, keeps its cookies, and the winner stays logged in', async () => {
    const s = await login(app);
    const [a, b] = await Promise.all([refresh(s.refreshToken), refresh(s.refreshToken)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
    const loser = a.status === 401 ? a : b;
    const winner = a.status === 200 ? a : b;
    expect(loser.body.error.code).toBe('REFRESH_INVALID');
    expect(loser.headers['set-cookie']).toBeUndefined();
    await refresh(winner.body.refreshToken as string).expect(200);
  });

  it('a rotated token presented again within the grace window does not revoke the family', async () => {
    const s = await login(app);
    const first = await refresh(s.refreshToken).expect(200);
    await refresh(s.refreshToken).expect(401);
    await refresh(first.body.refreshToken as string).expect(200);
  });

  it('reuse after the grace window still revokes the whole family', async () => {
    const s = await login(app);
    const first = await refresh(s.refreshToken).expect(200);
    // Age the rotation past the grace window.
    await app
      .get<Connection>(getConnectionToken())
      .collection('refreshTokens')
      .updateMany(
        { replacedBy: { $exists: true } },
        { $set: { revokedAt: new Date(Date.now() - 60_000) } },
      );
    const reused = await refresh(s.refreshToken);
    expect(reused.status).toBe(401);
    expect(reused.headers['set-cookie']).toBeDefined();
    await refresh(first.body.refreshToken as string).expect(401);
  });
});
