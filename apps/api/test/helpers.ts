import { OtpVerifyResponseSchema, type OtpVerifyResponse } from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';

let seq = 0;
/** Unique phones and client IPs per call so per-phone and per-IP limits never collide across tests. */
export const nextPhone = (prefix = '97') => `+91${prefix}${String(10_000_000 + ++seq).slice(-8)}`;
export const nextIp = () => `10.1.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;

export type Session = OtpVerifyResponse & {
  accessToken: string;
  refreshToken: string;
  auth: string;
};

/** Demo-mode login (OTP 123456) as a mobile client, so tokens come back in the body. */
export async function login(app: INestApplication, phone = nextPhone()): Promise<Session> {
  const http = () => request(app.getHttpServer());
  await http()
    .post('/api/v1/auth/otp/request')
    .set('X-Forwarded-For', nextIp())
    .send({ phone })
    .expect(200);
  const res = await http()
    .post('/api/v1/auth/otp/verify')
    .set('X-Forwarded-For', nextIp())
    .set('X-Doqto-Client', 'mobile')
    .send({ phone, code: '123456' })
    .expect(200);
  const body = OtpVerifyResponseSchema.parse(res.body) as Session;
  body.auth = `Bearer ${body.accessToken}`;
  return body;
}

/** Minimal valid files for upload tests (magic bytes are checked by the storage provider). */
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
