import type { DoctorProfile } from '@doqto/shared';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/messages/en';
import { createTranslator } from '@/i18n/translate';
import { formatDistance } from '@/components/search/search-page';
import { displayCity, physicianJsonLd } from './profile-view';

const t = createTranslator(en);

const profile: DoctorProfile = {
  id: '665f1c2b9d3e4a0012ab34cd',
  slug: 'dr-a-bareilly',
  name: 'Dr A </script><script>alert(1)</script>',
  gender: null,
  photoUrl: null,
  bio: null,
  languages: ['Hindi'],
  qualifications: [{ degree: 'MBBS' }],
  specialties: ['dermatology'],
  experienceYears: 5,
  verificationStatus: 'verified',
  city: 'bareilly',
  consultFee: 30000,
  bookingFee: 1500,
  clinics: [],
  ratingSummary: null,
  todayStatus: null,
};

describe('doctor page helpers', () => {
  it('escapes JSON-LD so profile text cannot close the script tag', () => {
    const json = physicianJsonLd(profile, 'https://doqto.in/d/dr-a-bareilly', {
      dermatology: 'Dermatologist',
    });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toMatchObject({
      '@type': 'Physician',
      name: profile.name,
      medicalSpecialty: ['Dermatologist'],
      priceRange: '₹300',
    });
  });

  it('title-cases the normalised city when there is no clinic address', () => {
    expect(displayCity(profile)).toBe('Bareilly');
  });

  it('formats distances for cards', () => {
    expect(formatDistance(20, t)).toBe('50 m away');
    expect(formatDistance(740, t)).toBe('750 m away');
    expect(formatDistance(3456, t)).toBe('3.5 km away');
    expect(formatDistance(23_400, t)).toBe('23 km away');
  });
});
