import {
  DoctorOnboardingRequestSchema,
  DoctorSearchQuerySchema,
  UpdateDoctorProfileRequestSchema,
} from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import { DoctorOnboardingDto, UpdateDoctorProfileDto } from './doctor.dto';
import { DoctorSearchQueryDto } from './search.dto';

const onboarding = {
  name: 'Dr Anita Sharma',
  qualifications: [{ degree: 'MBBS', institute: 'KGMU', year: 2010 }],
  specialties: ['general_physician'],
  registration: { council: 'Uttar Pradesh Medical Council', number: 'UPMC-1', year: 2011 },
};

describe('doctor DTOs match the shared contract', () => {
  expectParity([
    [
      'POST /doctor/onboarding',
      DoctorOnboardingDto,
      DoctorOnboardingRequestSchema,
      [
        onboarding,
        { ...onboarding, gender: 'female', languages: ['Hindi'], experienceYears: 12 },
        { ...onboarding, specialties: ['astrology'] },
        { ...onboarding, specialties: [] },
        { ...onboarding, qualifications: [] },
        { ...onboarding, gender: null },
        { ...onboarding, languages: null },
        { ...onboarding, experienceYears: null },
        { ...onboarding, isListed: true },
        { ...onboarding, registration: { council: 'U', number: '1', year: 2011 } },
      ],
    ],
    [
      'PATCH /doctor/profile',
      UpdateDoctorProfileDto,
      UpdateDoctorProfileRequestSchema,
      [
        { bio: 'Family doctor' },
        { bio: null },
        { gender: null },
        { consultFee: null },
        { bookingFee: 1500 },
        { bookingFee: 999 },
        { bookingFee: 2001 },
        { name: null },
        { languages: null },
        { qualifications: null },
        { specialties: null },
        { registration: null },
        { specialties: ['astrology'] },
        { verification: { status: 'verified' } },
        { ratingSummary: {} },
        { slug: 'dr-x' },
      ],
    ],
    [
      'GET /doctors (field rules; "city or near" is checked in the controller)',
      DoctorSearchQueryDto,
      DoctorSearchQuerySchema,
      [
        { city: 'Bareilly' },
        { near: '28.36,79.42' },
        { near: '95.0,79.4' },
        { near: '28.0,999' },
        { near: 'here' },
        { city: 'Bareilly', specialty: 'astrology' },
        { city: 'Bareilly', sort: 'payment' },
      ],
    ],
  ]);
});
