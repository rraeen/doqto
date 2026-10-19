/**
 * Doctor shapes (DB doc 3.2). Contract v1 (BE-05): onboarding, profile edit (private view),
 * public profile, search.
 *
 * Trust rule (TDD 5.8): nothing here, and nothing that feeds search ranking, carries a
 * payment field. `ratingSummary`, `verification` and `isListed` are never client-writable.
 */
import { z } from 'zod';
import { CursorQuerySchema, IsoDateTimeSchema, ObjectIdSchema, PaiseSchema } from './common';
import { ClinicSchema, LatLngSchema, type LatLng } from './clinics';
import { VerificationStatusSchema } from './enums';
import { REGISTRATION_COUNCIL_MAX, SpecialtyKeySchema } from './specialties';
import { DoctorStatusSchema } from './status';

export const GENDERS = ['female', 'male', 'other'] as const;
export const GenderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof GenderSchema>;

/** Doqto booking fee range in paise (₹10 to ₹20). */
export const BOOKING_FEE_MIN = 1000;
export const BOOKING_FEE_MAX = 2000;
/** Consultation fee paid at the clinic, informational (₹0 to ₹10,000). */
export const CONSULT_FEE_MAX = 1_000_000;

export const QualificationSchema = z.object({
  degree: z.string().trim().min(1).max(80),
  institute: z.string().trim().max(160).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
});
export type Qualification = z.infer<typeof QualificationSchema>;

/**
 * Cached rating summary, written only by the rating job (BE-35). Dimensions are averages on
 * a 1 to 5 scale. `null` until the doctor has at least 5 counted reviews ("New on Doqto").
 */
export const RatingSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  recommendPct: z.number().min(0).max(100),
  waitTime: z.number().min(1).max(5),
  explanation: z.number().min(1).max(5),
  behaviour: z.number().min(1).max(5),
  facilities: z.number().min(1).max(5),
  valueForMoney: z.number().min(1).max(5),
  updatedAt: IsoDateTimeSchema,
});
export type RatingSummary = z.infer<typeof RatingSummarySchema>;

/** Fields a doctor writes. Shared by onboarding (create) and `PATCH /doctor/profile`. */
const editable = {
  name: z.string().trim().min(2).max(80),
  gender: GenderSchema,
  bio: z.string().trim().max(1000),
  languages: z.array(z.string().trim().min(2).max(30)).max(8),
  qualifications: z.array(QualificationSchema).min(1).max(10),
  specialties: z.array(SpecialtyKeySchema).min(1).max(3),
  experienceYears: z.number().int().min(0).max(70),
  consultFee: PaiseSchema.max(CONSULT_FEE_MAX),
  bookingFee: PaiseSchema.min(BOOKING_FEE_MIN).max(BOOKING_FEE_MAX),
};

export const RegistrationSchema = z.object({
  council: z.string().trim().min(2).max(REGISTRATION_COUNCIL_MAX),
  number: z.string().trim().min(1).max(40),
  year: z.number().int().min(1950).max(2100),
});
export type Registration = z.infer<typeof RegistrationSchema>;

/**
 * `POST /doctor/onboarding` (any logged-in user, once). Creates the draft profile and adds
 * role `doctor`. The registration document is uploaded next with
 * `PUT /doctor/registration-document`.
 */
export const DoctorOnboardingRequestSchema = z
  .object({
    name: editable.name,
    gender: editable.gender.optional(),
    languages: editable.languages.optional(),
    qualifications: editable.qualifications,
    specialties: editable.specialties,
    experienceYears: editable.experienceYears.optional(),
    registration: RegistrationSchema,
  })
  .strict();
export type DoctorOnboardingRequest = z.infer<typeof DoctorOnboardingRequestSchema>;

/**
 * `PATCH /doctor/profile`. Editable fields only; `ratingSummary`, `verification`, `isListed`,
 * `slug` and anything else are rejected. Changing `registration` sends the profile back to
 * `pending` verification. `bio: null` / fee `null` clears the field.
 */
export const UpdateDoctorProfileRequestSchema = z
  .object({
    name: editable.name.optional(),
    gender: editable.gender.nullable().optional(),
    bio: editable.bio.nullable().optional(),
    languages: editable.languages.optional(),
    qualifications: editable.qualifications.optional(),
    specialties: editable.specialties.optional(),
    experienceYears: editable.experienceYears.nullable().optional(),
    consultFee: editable.consultFee.nullable().optional(),
    bookingFee: editable.bookingFee.nullable().optional(),
    registration: RegistrationSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });
export type UpdateDoctorProfileRequest = z.infer<typeof UpdateDoctorProfileRequestSchema>;

/** Accepted upload types for `PUT /doctor/registration-document` (multipart field `file`, max 5 MB). */
export const REGISTRATION_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const REGISTRATION_DOC_MAX_BYTES = 5 * 1024 * 1024;
/** Accepted for `PUT /doctor/photo` and `POST /clinics/:id/photos` (multipart field `file`, max 2 MB). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const RegistrationDocumentResponseSchema = z.object({
  uploadedAt: IsoDateTimeSchema,
  contentType: z.enum(REGISTRATION_DOC_TYPES),
  sizeBytes: z.number().int().positive(),
});
export type RegistrationDocumentResponse = z.infer<typeof RegistrationDocumentResponseSchema>;

/** What the profile still needs before it can be listed (shown as a checklist in FE-05). */
export const PROFILE_REQUIREMENTS = [
  'registration_document',
  'clinic',
  'specialties',
  'qualifications',
  'booking_fee',
] as const;
export const ProfileRequirementSchema = z.enum(PROFILE_REQUIREMENTS);

/** The doctor's own view (`GET /doctor/profile`, onboarding and PATCH responses). */
export const DoctorPrivateProfileSchema = z.object({
  id: ObjectIdSchema,
  slug: z.string(),
  name: z.string(),
  gender: GenderSchema.nullable(),
  photoUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  languages: z.array(z.string()),
  qualifications: z.array(QualificationSchema),
  specialties: z.array(SpecialtyKeySchema),
  experienceYears: z.number().int().nonnegative().nullable(),
  registration: RegistrationSchema.extend({ documentUploaded: z.boolean() }),
  verification: z.object({
    status: VerificationStatusSchema,
    /** Admin's note, shown to the doctor when rejected. */
    notes: z.string().nullable(),
    verifiedAt: IsoDateTimeSchema.nullable(),
  }),
  consultFee: PaiseSchema.nullable(),
  bookingFee: PaiseSchema.nullable(),
  clinicIds: z.array(ObjectIdSchema),
  city: z.string().nullable(),
  isListed: z.boolean(),
  /** Empty when the profile is complete; listing also needs `verification.status = verified`. */
  missing: z.array(ProfileRequirementSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type DoctorPrivateProfile = z.infer<typeof DoctorPrivateProfileSchema>;

/** One search result card (`GET /doctors`). */
export const DoctorListItemSchema = z.object({
  id: ObjectIdSchema,
  slug: z.string(),
  name: z.string(),
  photoUrl: z.string().url().nullable(),
  specialties: z.array(SpecialtyKeySchema),
  experienceYears: z.number().int().nonnegative().nullable(),
  city: z.string(),
  /** Informational consultation fee paid at the clinic, in paise. */
  consultFee: PaiseSchema.nullable(),
  ratingSummary: RatingSummarySchema.nullable(),
  /** Metres from `near=` when the query had one, else `null`. */
  distanceMeters: z.number().nonnegative().nullable(),
  /** Nearest (or first) clinic for the card. */
  primaryClinic: z
    .object({ id: ObjectIdSchema, name: z.string(), area: z.string().nullable() })
    .nullable(),
});
export type DoctorListItem = z.infer<typeof DoctorListItemSchema>;

/**
 * `GET /doctors?city=&specialty=&near=lat,lng&q=&cursor=&limit=`. Listed doctors only.
 * At least one of `city` or `near` is required. With `near`, results are within `radiusKm`
 * (default 25) and ranked by the ranking function (distance, specialty match, availability,
 * rating, review count; never payment). Cursor is opaque.
 */
export const NEAR_MESSAGE = 'Expected lat,lng inside India';

/** Parses `near` (`lat,lng`) and checks India bounds; `null` when malformed or out of range. */
export function parseNear(value: string): LatLng | null {
  if (!/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(value)) return null;
  const [lat, lng] = value.split(',').map(Number);
  const parsed = LatLngSchema.safeParse({ lat, lng });
  return parsed.success ? parsed.data : null;
}

export const DoctorSearchQuerySchema = CursorQuerySchema.extend({
  city: z.string().trim().min(1).max(80).optional(),
  specialty: SpecialtyKeySchema.optional(),
  /** `lat,lng` inside India (`LatLngSchema` bounds), e.g. `28.367,79.432`. */
  near: z
    .string()
    .refine((v) => parseNear(v) !== null, NEAR_MESSAGE)
    .optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(25),
  /** Free-text name search. */
  q: z.string().trim().min(2).max(60).optional(),
})
  // Unknown query keys are a 400, as the API does (e.g. `sort=payment`).
  .strict()
  .refine((v) => v.city !== undefined || v.near !== undefined, {
    message: 'Provide city or near',
    path: ['city'],
  });
export type DoctorSearchQuery = z.input<typeof DoctorSearchQuerySchema>;

/** Public profile (`GET /doctors/:slug`). */
export const DoctorProfileSchema = z.object({
  id: ObjectIdSchema,
  slug: z.string(),
  name: z.string(),
  gender: GenderSchema.nullable(),
  photoUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  languages: z.array(z.string()),
  qualifications: z.array(QualificationSchema),
  specialties: z.array(SpecialtyKeySchema),
  experienceYears: z.number().int().nonnegative().nullable(),
  /** Shown as "Registration verified"; the number and document are never public. */
  verificationStatus: VerificationStatusSchema,
  city: z.string(),
  consultFee: PaiseSchema.nullable(),
  /** Doqto booking fee in paise (1000 to 2000). */
  bookingFee: PaiseSchema.nullable(),
  clinics: z.array(ClinicSchema),
  ratingSummary: RatingSummarySchema.nullable(),
  todayStatus: DoctorStatusSchema.nullable(),
});
export type DoctorProfile = z.infer<typeof DoctorProfileSchema>;
