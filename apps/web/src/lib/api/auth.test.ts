import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import { getMe, logout, requestOtp, updateMe, verifyOtp } from './auth';
import { ApiError, detailNumber } from './errors';

const server = setupServer(...handlers);
const phone = '+919876543210';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => resetMockDb());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function expectApiError(promise: Promise<unknown>, code: string): Promise<ApiError> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
}

describe('auth API client against the contract mocks', () => {
  it('logs in with the demo code, edits the profile and logs out', async () => {
    const sent = await requestOtp(phone);
    expect(sent.channel).toBe('demo');

    const login = await verifyOtp({ phone, code: '123456', whatsappOptIn: false });
    expect(login.isNewUser).toBe(true);
    expect(login.user).toMatchObject({
      phone,
      name: null,
      roles: ['patient'],
      whatsappOptIn: false,
    });

    const updated = await updateMe({ name: 'Sunita Verma', language: 'hi' });
    expect(updated).toMatchObject({ name: 'Sunita Verma', language: 'hi' });
    expect((await getMe()).name).toBe('Sunita Verma');

    await logout();
    await expectApiError(getMe(), 'UNAUTHENTICATED');
  });

  it('counts down attempts and locks after five wrong codes', async () => {
    await requestOtp(phone);
    const first = await expectApiError(verifyOtp({ phone, code: '000000' }), 'OTP_INVALID');
    expect(detailNumber(first, 'attemptsLeft')).toBe(4);
    for (let i = 0; i < 3; i++)
      await expectApiError(verifyOtp({ phone, code: '000000' }), 'OTP_INVALID');
    await expectApiError(verifyOtp({ phone, code: '000000' }), 'OTP_LOCKED');
    await expectApiError(verifyOtp({ phone, code: '123456' }), 'OTP_LOCKED');
  });

  it('rejects a code that was never requested', async () => {
    await expectApiError(verifyOtp({ phone, code: '123456' }), 'OTP_EXPIRED');
  });

  it('rate limits the fourth code request in ten minutes', async () => {
    for (let i = 0; i < 3; i++) await requestOtp(phone);
    const err = await expectApiError(requestOtp(phone), 'RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(detailNumber(err, 'retryAfterSeconds')).toBeGreaterThan(0);
  });

  it('rejects an invalid phone with VALIDATION_FAILED', async () => {
    await expectApiError(requestOtp('+911234567890'), 'VALIDATION_FAILED');
  });
});
