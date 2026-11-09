import { type ProfileRequirementSchema } from '@doqto/shared';
import type { z } from 'zod';
import type { Doctor } from './doctor.schema';

type Requirement = z.infer<typeof ProfileRequirementSchema>;

/** What the profile still needs before it can be listed (FE-05 checklist). */
export function missingRequirements(
  d: Pick<Doctor, 'registration' | 'clinicIds' | 'specialties' | 'qualifications' | 'bookingFee'> &
    Partial<Pick<Doctor, 'unitId'>>,
): Requirement[] {
  const missing: Requirement[] = [];
  // A doctor listed from an approved application had the registration checked by Doqto's team
  // (document uploads on the application form come later); the old flow needs the scan.
  if (!d.registration?.docKey && !d.unitId) missing.push('registration_document');
  if (d.clinicIds.length === 0) missing.push('clinic');
  if (d.specialties.length === 0) missing.push('specialties');
  if (d.qualifications.length === 0) missing.push('qualifications');
  if (d.bookingFee == null) missing.push('booking_fee');
  return missing;
}

/** BE-06: `isListed` is true only when verified and the profile is complete. */
export function computeIsListed(
  d: Parameters<typeof missingRequirements>[0] & Pick<Doctor, 'verification'>,
): boolean {
  return d.verification?.status === 'verified' && missingRequirements(d).length === 0;
}
