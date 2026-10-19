import {
  ApiErrorSchema,
  MeSchema,
  OtpRequestResponseSchema,
  OtpVerifyResponseSchema,
  RefreshResponseSchema,
  WHATSAPP_CONSENT_VERSION,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import request from 'supertest';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
let seq = 0;
/** A fresh phone and client IP per test so rate limits never leak between tests. */
const nextPhone = () => `+9198${String(10_000_000 + ++seq).slice(-8)}`;
const nextIp = () => `10.0.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;

function errorCode(body: unknown): string {
  return ApiErrorSchema.parse(body).error.code;
}

function cookieMap(res: request.Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries((raw ?? []).map((c) => [c.split('=')[0], c]));
}

describe('phone OTP auth and /me (BE-04)', () => {
  let app: INestApplication;
  let db: Connection;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  const requestOtp = (phone: string, ip = nextIp()) =>
    http().post('/api/v1/auth/otp/request').set('X-Forwarded-For', ip).send({ phone });
  const verify = (phone: string, code = DEMO_CODE, extra: Record<string, unknown> = {}) =>
    http()
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', nextIp())
      .set('X-Doqto-Client', 'mobile')
      .send({ phone, code, ...extra });

  async function login(phone = nextPhone(), extra: Record<string, unknown> = {}) {
    await requestOtp(phone).expect(200);
    const res = await verify(phone, DEMO_CODE, extra).expect(200);
    return { phone, res, body: OtpVerifyResponseSchema.parse(res.body) };
  }

  describe('full login flow in demo mode', () => {
    it('requests an OTP, verifies 123456, creates a patient and sets cookies', async () => {
      const phone = nextPhone();
      const req = await requestOtp(phone).expect(200);
      const otpRes = OtpRequestResponseSchema.parse(req.body);
      expect(otpRes.channel).toBe('demo');
      expect(new Date(otpRes.expiresAt).getTime() - Date.now()).toBeGreaterThan(290_000);

      const stored = await db.collection('otps').findOne({ phone });
      expect(stored?.codeHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(stored)).not.toContain(DEMO_CODE);

      const res = await verify(phone, DEMO_CODE, { whatsappOptIn: false }).expect(200);
      const body = OtpVerifyResponseSchema.parse(res.body);
      expect(body.isNewUser).toBe(true);
      expect(body.user).toMatchObject({
        phone,
        roles: ['patient'],
        name: null,
        isDemo: true,
        whatsappOptIn: false,
      });
      expect(new Date(body.accessTokenExpiresAt).getTime() - Date.now()).toBeLessThanOrEqual(
        15 * 60_000,
      );
      expect(new Date(body.refreshTokenExpiresAt).getTime() - Date.now()).toBeGreaterThan(
        29 * 86_400_000,
      );

      const cookies = cookieMap(res);
      expect(cookies.doqto_at).toMatch(/HttpOnly/i);
      expect(cookies.doqto_at).toMatch(/SameSite=Lax/i);
      expect(cookies.doqto_rt).toMatch(/Path=\/api\/v1\/auth/);
      expect(await db.collection('otps').countDocuments({ phone })).toBe(0);

      const user = await db.collection('users').findOne({ phone });
      expect(user?.consentLog).toEqual([
        expect.objectContaining({
          type: 'whatsapp',
          version: WHATSAPP_CONSENT_VERSION,
          granted: false,
        }),
      ]);
      const rt = await db.collection('refreshTokens').findOne({ userId: user?._id });
      expect(rt?.tokenHash).not.toBe(body.refreshToken);
    });

    it('keeps tokens out of the JSON body for web clients (cookies only)', async () => {
      const phone = nextPhone();
      await requestOtp(phone).expect(200);
      const res = await http()
        .post('/api/v1/auth/otp/verify')
        .set('X-Forwarded-For', nextIp())
        .send({ phone, code: DEMO_CODE })
        .expect(200);
      const body = OtpVerifyResponseSchema.parse(res.body);
      expect(body.accessToken).toBeUndefined();
      expect(body.refreshToken).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(
        cookieMap(res).doqto_rt!.split(';')[0]!.split('=')[1]!,
      );
      const rt = cookieMap(res).doqto_rt!.split(';')[0]!;
      const r = await http().post('/api/v1/auth/refresh').set('Cookie', rt).send({}).expect(200);
      expect(r.body.refreshToken).toBeUndefined();
      expect(r.body.refreshTokenExpiresAt).toBeDefined();
    });

    it('logs an existing user in again without creating a new account', async () => {
      const { phone } = await login();
      const again = await login(phone);
      expect(again.body.isNewUser).toBe(false);
      expect(await db.collection('users').countDocuments({ phone })).toBe(1);
    });

    it('does not reuse a code after a successful login', async () => {
      const { phone } = await login();
      expect(errorCode((await verify(phone).expect(400)).body)).toBe('OTP_EXPIRED');
    });
  });

  describe('/me', () => {
    it('returns the user with a Bearer token or the access cookie', async () => {
      const { body, res } = await login();
      const viaBearer = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(MeSchema.parse(viaBearer.body).id).toBe(body.user.id);
      const cookie = cookieMap(res).doqto_at!.split(';')[0]!;
      const viaCookie = await http().get('/api/v1/me').set('Cookie', cookie).expect(200);
      expect(viaCookie.body.id).toBe(body.user.id);
    });

    it('rejects missing and invalid tokens', async () => {
      expect(errorCode((await http().get('/api/v1/me').expect(401)).body)).toBe('UNAUTHENTICATED');
      await http().get('/api/v1/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('updates name, language and WhatsApp opt-in, logging consent changes', async () => {
      const { body } = await login();
      const auth = `Bearer ${body.accessToken}`;
      const res = await http()
        .patch('/api/v1/me')
        .set('Authorization', auth)
        .send({ name: '  Asha Verma ', language: 'hi', whatsappOptIn: false })
        .expect(200);
      expect(MeSchema.parse(res.body)).toMatchObject({
        name: 'Asha Verma',
        language: 'hi',
        whatsappOptIn: false,
      });
      const user = await db.collection('users').findOne({ phone: body.user.phone });
      expect(user?.consentLog.map((c: { granted: boolean }) => c.granted)).toEqual([true, false]);
    });

    it('rejects unknown fields, privileged fields and empty patches', async () => {
      const { body } = await login();
      const auth = `Bearer ${body.accessToken}`;
      const bad = await http()
        .patch('/api/v1/me')
        .set('Authorization', auth)
        .send({ roles: ['admin'] })
        .expect(400);
      expect(errorCode(bad.body)).toBe('VALIDATION_FAILED');
      await http()
        .patch('/api/v1/me')
        .set('Authorization', auth)
        .send({ name: { $gt: '' } })
        .expect(400);
      await http()
        .patch('/api/v1/me')
        .set('Authorization', auth)
        .send({ language: 'fr' })
        .expect(400);
      await http().patch('/api/v1/me').set('Authorization', auth).send({}).expect(400);
      const me = await http().get('/api/v1/me').set('Authorization', auth).expect(200);
      expect(me.body.roles).toEqual(['patient']);
    });
  });

  describe('wrong codes and expiry', () => {
    it('locks the code after 5 wrong attempts, even for the right code, until a new OTP', async () => {
      const phone = nextPhone();
      await requestOtp(phone).expect(200);
      for (let left = 4; left >= 0; left--) {
        const res = await verify(phone, '000000').expect(400);
        expect(ApiErrorSchema.parse(res.body).error).toMatchObject({
          code: 'OTP_INVALID',
          details: { attemptsLeft: left },
        });
      }
      expect(errorCode((await verify(phone, DEMO_CODE).expect(400)).body)).toBe('OTP_LOCKED');
      await requestOtp(phone).expect(200);
      await verify(phone, DEMO_CODE).expect(200);
    });

    it('never allows more than 5 guesses when they arrive in parallel', async () => {
      const phone = nextPhone();
      await requestOtp(phone).expect(200);
      const results = await Promise.all(Array.from({ length: 10 }, () => verify(phone, '000000')));
      const codes = results.map((r) => errorCode(r.body));
      expect(codes.filter((c) => c === 'OTP_INVALID')).toHaveLength(5);
      expect(codes.filter((c) => c === 'OTP_LOCKED')).toHaveLength(5);
    });

    it('rejects a verify with no OTP requested, and an expired OTP', async () => {
      const phone = nextPhone();
      expect(errorCode((await verify(phone).expect(400)).body)).toBe('OTP_EXPIRED');
      await requestOtp(phone).expect(200);
      await db
        .collection('otps')
        .updateOne({ phone }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      expect(errorCode((await verify(phone).expect(400)).body)).toBe('OTP_EXPIRED');
    });

    it('validates phone and code format', async () => {
      expect(errorCode((await requestOtp('9876543210').expect(400)).body)).toBe(
        'VALIDATION_FAILED',
      );
      await verify(nextPhone(), '12ab56').expect(400);
      await http()
        .post('/api/v1/auth/otp/request')
        .send({ phone: nextPhone(), purpose: 'visit' })
        .expect(400);
    });
  });

  describe('rate limits', () => {
    it('allows 3 OTP requests per phone in 10 minutes, then 429', async () => {
      const phone = nextPhone();
      for (let i = 0; i < 3; i++) await requestOtp(phone, nextIp()).expect(200);
      const res = await requestOtp(phone, nextIp()).expect(429);
      const err = ApiErrorSchema.parse(res.body).error;
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.details?.retryAfterSeconds).toBeGreaterThan(0);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('caps OTP verifies per IP', async () => {
      const ip = '192.168.88.8';
      const phone = nextPhone();
      const codes: number[] = [];
      for (let i = 0; i < 21; i++) {
        codes.push(
          (
            await http()
              .post('/api/v1/auth/otp/verify')
              .set('X-Forwarded-For', ip)
              .send({ phone, code: '000000' })
          ).status,
        );
      }
      expect(codes.slice(0, 20).every((c) => c === 400)).toBe(true);
      expect(codes[20]).toBe(429);
    });

    it('allows 3 OTP requests per IP in 10 minutes, then 429', async () => {
      const ip = '192.168.77.7';
      for (let i = 0; i < 3; i++) await requestOtp(nextPhone(), ip).expect(200);
      expect(errorCode((await requestOtp(nextPhone(), ip).expect(429)).body)).toBe('RATE_LIMITED');
    });
  });

  describe('refresh and logout', () => {
    it('rotates the refresh token; reusing the old one later revokes the whole family', async () => {
      const { body } = await login();
      const r1 = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: body.refreshToken })
        .expect(200);
      const pair = RefreshResponseSchema.parse(r1.body);
      expect(pair.refreshToken).not.toBe(body.refreshToken);
      await http().get('/api/v1/me').set('Authorization', `Bearer ${pair.accessToken}`).expect(200);

      // Past the 20-second parallel-refresh grace window (auth-review-fixes.e2e-spec.ts covers inside it).
      await db
        .collection('refreshTokens')
        .updateMany(
          { replacedBy: { $exists: true } },
          { $set: { revokedAt: new Date(Date.now() - 60_000) } },
        );
      const reuse = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
      expect(errorCode(reuse.body)).toBe('REFRESH_INVALID');
      // The legitimately rotated token died with its family.
      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: pair.refreshToken })
        .expect(401);
    });

    it('refreshes from the cookie for web clients', async () => {
      const { res } = await login();
      const rt = cookieMap(res).doqto_rt!.split(';')[0]!;
      const r = await http().post('/api/v1/auth/refresh').set('Cookie', rt).send({}).expect(200);
      expect(cookieMap(r).doqto_rt).toBeDefined();
    });

    it('logout revokes the session and is idempotent', async () => {
      const { body } = await login();
      const out = await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: body.refreshToken })
        .expect(204);
      expect(cookieMap(out).doqto_at).toMatch(/Expires=Thu, 01 Jan 1970/);
      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
      await http().post('/api/v1/auth/logout').send({ refreshToken: 'unknown-token' }).expect(204);
      await http().post('/api/v1/auth/logout').send({}).expect(204);
    });

    it('rejects a missing or unknown refresh token', async () => {
      await http().post('/api/v1/auth/refresh').send({}).expect(401);
      await http().post('/api/v1/auth/refresh').send({ refreshToken: 'nope' }).expect(401);
    });
  });

  describe('suspended accounts', () => {
    it('cannot log in, refresh or read /me', async () => {
      const { phone, body } = await login();
      await db.collection('users').updateOne({ phone }, { $set: { status: 'suspended' } });
      const me = await http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(403);
      expect(errorCode(me.body)).toBe('ACCOUNT_SUSPENDED');
      const r = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Doqto-Client', 'mobile')
        .send({ refreshToken: body.refreshToken })
        .expect(403);
      expect(errorCode(r.body)).toBe('ACCOUNT_SUSPENDED');
      await requestOtp(phone).expect(200);
      expect(errorCode((await verify(phone).expect(403)).body)).toBe('ACCOUNT_SUSPENDED');
    });
  });
});
