import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockConfig, resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import {
  deleteMyAccount,
  exportMyData,
  getTransparency,
  registerPush,
  unregisterPush,
} from './account';
import { getMe, requestOtp, updateMe, verifyOtp } from './auth';
import { ApiError } from './errors';
import { createReview, getDoctorReviews, getReviewEligibility } from './reviews';
import { listMyAppointments } from './appointments';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetMockDb();
  mockConfig.seedPastVisits = true;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function signIn(phone: string, name?: string) {
  await requestOtp(phone);
  await verifyOtp({ phone, code: '123456' });
  if (name) await updateMe({ name });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return (err as ApiError).code;
}

const device = (n: number) => ({
  endpoint: `https://push.example.test/send/device-${n}`,
  keys: { p256dh: `key-${n}`, auth: `auth-${n}` },
});

describe('account, push and transparency against the contract mocks', { timeout: 30_000 }, () => {
  it('registers devices for push: the same device twice is one, six is too many', async () => {
    await signIn('+919811300001');
    const first = await registerPush(device(1));
    expect(first.count).toBe(1);
    expect((await registerPush(device(1))).id).toBe(first.id);
    for (const n of [2, 3, 4, 5]) await registerPush(device(n));
    expect(await codeOf(registerPush(device(6)))).toBe('CONFLICT');
    await unregisterPush(first.id);
    expect((await registerPush(device(6))).count).toBe(5);
  });

  it('exports the profile, visits and reviews, without the visit code', async () => {
    await signIn('+919811300002', 'Asha Devi');
    const open = (await getReviewEligibility()).find((x) => x.state === 'open')!;
    await createReview({
      appointmentId: open.appointmentId,
      ratings: { waitTime: 5, explanation: 5, behaviour: 5, facilities: 5, valueForMoney: 5 },
      wouldRecommend: 'yes',
      reason: 'checkup',
    });
    const data = await exportMyData();
    expect(data.profile.phone).toBe('+919811300002');
    expect(data.appointments.length).toBe(3);
    expect(data.reviews).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('visitCode');
  });

  it('deletes the account: signed out for good, name blanked, reviews kept as Verified patient', async () => {
    await signIn('+919811300003', 'Asha Devi');
    const open = (await getReviewEligibility()).find((x) => x.state === 'open')!;
    await createReview({
      appointmentId: open.appointmentId,
      ratings: { waitTime: 5, explanation: 5, behaviour: 5, facilities: 5, valueForMoney: 5 },
      wouldRecommend: 'yes',
      reason: 'checkup',
      text: 'The doctor explained everything clearly and kindly.',
    });
    await deleteMyAccount();

    expect(await codeOf(getMe())).toBe('UNAUTHENTICATED');
    expect(await codeOf(listMyAppointments())).toBe('UNAUTHENTICATED');

    // The review stays for the doctor, with no name.
    const list = await getDoctorReviews(open.doctor.id);
    expect(list.items.some((r) => r.reviewerName === 'Verified patient')).toBe(true);
    expect(list.items.some((r) => r.reviewerName.startsWith('Asha'))).toBe(false);
  });

  it('shows public transparency numbers for the latest months, newest first', async () => {
    const t = await getTransparency();
    expect(t.months).toHaveLength(3);
    const months = t.months.map((m) => m.month);
    expect([...months].sort().reverse()).toEqual(months);
    expect(t.months[1]!.reviewsSubmitted).toBeGreaterThan(0);
  });

  it('refuses account tools when signed out', async () => {
    expect(await codeOf(registerPush(device(1)))).toBe('UNAUTHENTICATED');
    expect(await codeOf(exportMyData())).toBe('UNAUTHENTICATED');
    expect(await codeOf(deleteMyAccount())).toBe('UNAUTHENTICATED');
  });
});
