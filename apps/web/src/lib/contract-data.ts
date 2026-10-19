import 'server-only';
import {
  BOOKING_FEE_MAX,
  BOOKING_FEE_MIN,
  CLINIC_PHOTOS_MAX,
  CONSULT_FEE_MAX,
  NAME_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  REGISTRATION_DOC_MAX_BYTES,
  REGISTRATION_DOC_TYPES,
  SPECIALTIES,
} from '@doqto/shared';
import type { Locale } from '@/i18n/config';

/**
 * Contract constants that client components need, read on the server and passed down as plain
 * props, so `@doqto/shared` (and Zod with it) stays out of the browser's first-load JS.
 */
export function getFormConfig(locale: Locale) {
  return {
    specialties: SPECIALTIES.map((s) => ({ key: s.key, label: s[locale] })),
    maxSpecialties: 3,
    bookingFeeMin: BOOKING_FEE_MIN,
    bookingFeeMax: BOOKING_FEE_MAX,
    consultFeeMax: CONSULT_FEE_MAX,
    nameMax: NAME_MAX,
    photoTypes: [...PHOTO_TYPES] as string[],
    photoMaxBytes: PHOTO_MAX_BYTES,
    docTypes: [...REGISTRATION_DOC_TYPES] as string[],
    docMaxBytes: REGISTRATION_DOC_MAX_BYTES,
    clinicPhotosMax: CLINIC_PHOTOS_MAX,
  };
}

export type FormConfig = ReturnType<typeof getFormConfig>;

export function specialtyLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(SPECIALTIES.map((s) => [s.key, s[locale]]));
}
