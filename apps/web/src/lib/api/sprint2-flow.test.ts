import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MOCK_ADMIN_PHONE, resetMockDb } from '@/mocks/db';
import { handlers } from '@/mocks/handlers';
import { getDoctorForReview, listDoctorQueue, verifyDoctor } from './admin';
import { logout, refreshNow, requestOtp, verifyOtp } from './auth';
import { addStaff, createClinic, geocode, listMyClinics, removeStaff } from './clinics';
import {
  getDoctorProfile,
  onboardDoctor,
  updateDoctorProfile,
  uploadRegistrationDocument,
} from './doctor';
import { getDoctorBySlug, searchDoctors } from './doctors';
import { ApiError } from './errors';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => resetMockDb());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function signIn(phone: string) {
  await requestOtp(phone);
  await verifyOtp({ phone, code: '123456' });
}

async function code(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return (err as ApiError).code;
}

// The mocks add realistic latency, so a whole journey takes a few seconds.
describe('sprint 2 flow against the contract mocks', { timeout: 20_000 }, () => {
  it('onboards a doctor, sets up a clinic, gets approved and shows up in search', async () => {
    await signIn('+919811122233');
    expect(await getDoctorProfile()).toBeNull();
    await onboardDoctor({
      name: 'Dr Meera Gupta',
      qualifications: [{ degree: 'MBBS' }],
      specialties: ['dermatology'],
      registration: { council: 'Uttar Pradesh Medical Council', number: 'UP-55123', year: 2012 },
    });
    await refreshNow();
    await uploadRegistrationDocument(new File(['scan'], 'reg.pdf', { type: 'application/pdf' }));
    await updateDoctorProfile({ consultFee: 40000, bookingFee: 1500 });

    const pins = await geocode({ city: 'Bareilly' });
    const clinic = await createClinic({
      name: 'Gupta Skin Clinic',
      address: {
        line1: '12 Civil Lines',
        city: 'Bareilly',
        state: 'Uttar Pradesh',
        pincode: '243001',
      },
      location: { lat: pins.items[0]!.lat, lng: pins.items[0]!.lng },
    });
    const withStaff = await addStaff(clinic.id, { phone: '+919822233344', name: 'Ravi' });
    expect(withStaff.staff).toHaveLength(1);
    expect(await code(addStaff(clinic.id, { phone: '+919822233344' }))).toBe('CONFLICT');
    expect((await removeStaff(clinic.id, withStaff.staff[0]!.userId)).staff).toHaveLength(0);
    expect(await listMyClinics()).toHaveLength(1);

    const pending = await getDoctorProfile();
    expect(pending).toMatchObject({ isListed: false, missing: [] });
    expect(pending?.verification.status).toBe('pending');
    await logout();

    await signIn(MOCK_ADMIN_PHONE);
    const queue = await listDoctorQueue('pending');
    const item = queue.items.find((d) => d.name === 'Dr Meera Gupta');
    expect(item?.documentUploaded).toBe(true);
    const detail = await getDoctorForReview(item!.id);
    expect(
      await code(verifyDoctor(item!.id, { decision: 'approve', reviewToken: 'x'.repeat(20) })),
    ).toBe('CONFLICT');
    const approved = await verifyDoctor(item!.id, {
      decision: 'approve',
      reviewToken: detail.reviewToken,
    });
    expect(approved).toMatchObject({ isListed: true });
    // A second decision on the same review is a conflict, as on the API.
    expect(
      await code(
        verifyDoctor(item!.id, {
          decision: 'reject',
          notes: 'Too late',
          reviewToken: detail.reviewToken,
        }),
      ),
    ).toBe('CONFLICT');
    await logout();

    const found = await searchDoctors({ city: 'bareilly', specialty: 'dermatology' });
    const hit = found.items.find((d) => d.name === 'Dr Meera Gupta');
    expect(hit).toBeDefined();
    const page = await getDoctorBySlug(hit!.slug);
    expect(page).toMatchObject({ verificationStatus: 'verified', consultFee: 40000 });
    expect(page?.clinics[0]?.mapsUrl).toMatch(/^https:\/\//);
    expect(await getDoctorBySlug('dr-nobody-nowhere')).toBeNull();
  });

  it('sends a verified doctor back to review on a real rename, not on a "Dr" or case change', async () => {
    await signIn('+919811122299');
    await onboardDoctor({
      name: 'Dr Kavita Rao',
      qualifications: [{ degree: 'MBBS' }],
      specialties: ['general_physician'],
      registration: { council: 'Uttar Pradesh Medical Council', number: 'UP-1', year: 2010 },
    });
    await refreshNow();
    await uploadRegistrationDocument(new File(['scan'], 'reg.pdf', { type: 'application/pdf' }));
    await logout();
    await signIn(MOCK_ADMIN_PHONE);
    const item = (await listDoctorQueue('pending')).items.find((d) => d.name === 'Dr Kavita Rao')!;
    const { reviewToken } = await getDoctorForReview(item.id);
    await verifyDoctor(item.id, { decision: 'approve', reviewToken });
    await logout();

    await signIn('+919811122299');
    expect((await updateDoctorProfile({ name: 'kavita  rao' })).verification.status).toBe(
      'verified',
    );
    expect((await updateDoctorProfile({ name: 'Dr Kavita Reddy' })).verification.status).toBe(
      'pending',
    );
  });

  it('lists everyone with no filter, and pages near-me results by distance', async () => {
    const everyone = await searchDoctors({});
    expect(everyone.items).toHaveLength(20);
    expect(everyone.total).toBeGreaterThan(20);
    expect(everyone.nextCursor).not.toBeNull();
    const first = await searchDoctors({ near: '28.367,79.432' });
    expect(first.items.length).toBeGreaterThan(0);
    const distances = first.items.map((d) => d.distanceMeters ?? Infinity);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });
});
