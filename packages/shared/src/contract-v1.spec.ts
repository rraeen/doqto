import {
  AddStaffRequestSchema,
  CreateClinicRequestSchema,
  DoctorOnboardingRequestSchema,
  DoctorSearchQuerySchema,
  SPECIALTY_KEYS,
  UpdateClinicRequestSchema,
  UpdateDoctorProfileRequestSchema,
  VerifyDoctorRequestSchema,
} from './index';

const onboarding = {
  name: 'Dr Anita Sharma',
  qualifications: [{ degree: 'MBBS', institute: 'KGMU', year: 2010 }],
  specialties: ['general_physician'],
  registration: { council: 'Uttar Pradesh Medical Council', number: 'UPMC-12345', year: 2011 },
};

describe('contract v1', () => {
  it('specialty keys are unique snake_case', () => {
    expect(new Set(SPECIALTY_KEYS).size).toBe(SPECIALTY_KEYS.length);
    for (const k of SPECIALTY_KEYS) expect(k).toMatch(/^[a-z_]+$/);
  });

  it('onboarding needs registration, a known specialty and a qualification', () => {
    expect(DoctorOnboardingRequestSchema.safeParse(onboarding).success).toBe(true);
    expect(
      DoctorOnboardingRequestSchema.safeParse({ ...onboarding, specialties: ['astrology'] })
        .success,
    ).toBe(false);
    expect(
      DoctorOnboardingRequestSchema.safeParse({ ...onboarding, qualifications: [] }).success,
    ).toBe(false);
    expect(DoctorOnboardingRequestSchema.safeParse({ ...onboarding, isListed: true }).success).toBe(
      false,
    );
  });

  it('profile edits reject trust fields and keep fees in the allowed paise range', () => {
    expect(UpdateDoctorProfileRequestSchema.safeParse({ bio: 'Hello' }).success).toBe(true);
    for (const field of ['ratingSummary', 'verification', 'isListed', 'slug']) {
      expect(UpdateDoctorProfileRequestSchema.safeParse({ [field]: {} }).success).toBe(false);
    }
    expect(UpdateDoctorProfileRequestSchema.safeParse({ bookingFee: 1500 }).success).toBe(true);
    expect(UpdateDoctorProfileRequestSchema.safeParse({ bookingFee: 500 }).success).toBe(false);
    expect(UpdateDoctorProfileRequestSchema.safeParse({ bookingFee: 15.5 }).success).toBe(false);
    expect(UpdateDoctorProfileRequestSchema.safeParse({}).success).toBe(false);
  });

  it('clinic create and update', () => {
    const address = {
      line1: '12 Civil Lines',
      city: 'Bareilly',
      state: 'Uttar Pradesh',
      pincode: '243001',
    };
    expect(
      CreateClinicRequestSchema.safeParse({
        name: 'Sharma Clinic',
        address,
        location: { lat: 28.36, lng: 79.43 },
      }).success,
    ).toBe(true);
    // Swapped coordinates fall outside India's bounds.
    expect(
      CreateClinicRequestSchema.safeParse({
        name: 'X Clinic',
        address,
        location: { lat: 79.43, lng: 28.36 },
      }).success,
    ).toBe(false);
    expect(
      CreateClinicRequestSchema.safeParse({
        name: 'X Clinic',
        address: { ...address, pincode: '012345' },
      }).success,
    ).toBe(false);
    expect(UpdateClinicRequestSchema.safeParse({ location: null }).success).toBe(true);
    expect(UpdateClinicRequestSchema.safeParse({ staffUserIds: [] }).success).toBe(false);
    expect(AddStaffRequestSchema.safeParse({ phone: '+919876543210' }).success).toBe(true);
  });

  it('search needs city or near, and validates near', () => {
    expect(DoctorSearchQuerySchema.safeParse({}).success).toBe(false);
    expect(DoctorSearchQuerySchema.parse({ city: 'Bareilly' })).toMatchObject({
      limit: 20,
      radiusKm: 25,
    });
    expect(
      DoctorSearchQuerySchema.safeParse({ near: '28.36,79.43', specialty: 'dentistry' }).success,
    ).toBe(true);
    expect(DoctorSearchQuerySchema.safeParse({ near: 'here' }).success).toBe(false);
  });

  it('rejections need a note; every decision carries the review token (v2)', () => {
    const reviewToken = 'abcdefghijklmnopqrstuvwxyz012345';
    expect(VerifyDoctorRequestSchema.safeParse({ decision: 'approve', reviewToken }).success).toBe(
      true,
    );
    expect(VerifyDoctorRequestSchema.safeParse({ decision: 'approve' }).success).toBe(false);
    expect(VerifyDoctorRequestSchema.safeParse({ decision: 'reject', reviewToken }).success).toBe(
      false,
    );
    expect(
      VerifyDoctorRequestSchema.safeParse({
        decision: 'reject',
        notes: 'Registration number not found',
        reviewToken,
      }).success,
    ).toBe(true);
  });
});
