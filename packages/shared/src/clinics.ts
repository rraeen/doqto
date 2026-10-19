/**
 * Clinic shapes (DB doc 3.3). Contract v1 (BE-05).
 */
import { z } from 'zod';
import { GeoPointSchema, IsoDateTimeSchema, ObjectIdSchema, PhoneSchema } from './common';

export const AddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(80),
  district: z.string().trim().max(80).optional(),
  state: z.string().trim().min(1).max(80),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Expected a 6-digit PIN code'),
});
export type Address = z.infer<typeof AddressSchema>;

/** Pin from the map picker, `{ lat, lng }`. The API stores it as GeoJSON `[lng, lat]`. */
export const LatLngSchema = z.object({
  lat: z.number().min(6).max(38),
  lng: z.number().min(68).max(98),
});
export type LatLng = z.infer<typeof LatLngSchema>;

/** Public clinic view, as embedded in a doctor profile. */
export const ClinicSchema = z.object({
  id: ObjectIdSchema,
  name: z.string(),
  phone: z.string().nullable(),
  address: AddressSchema,
  location: GeoPointSchema.nullable(),
  /** Public photo URLs (the API turns R2 keys into URLs). */
  photoUrls: z.array(z.string().url()),
  timezone: z.literal('Asia/Kolkata'),
  /** "Open in Google Maps" link (INT-07); `null` until a pin is set. */
  mapsUrl: z.string().url().nullable(),
});
export type Clinic = z.infer<typeof ClinicSchema>;

export const ClinicStaffMemberSchema = z.object({
  userId: ObjectIdSchema,
  name: z.string().nullable(),
  phone: PhoneSchema,
  addedAt: IsoDateTimeSchema.nullable(),
});
export type ClinicStaffMember = z.infer<typeof ClinicStaffMemberSchema>;

/** Owner / staff view (`GET /clinics/mine`, `GET /clinics/:id`, create and update responses). */
export const ClinicPrivateSchema = ClinicSchema.extend({
  ownerUserId: ObjectIdSchema,
  doctorIds: z.array(ObjectIdSchema),
  /** Empty for read-only staff (`canManage: false`): they do not see co-workers' phones. */
  staff: z.array(ClinicStaffMemberSchema),
  /** Caller can edit details and manage staff (the owner or a doctor of this clinic). */
  canManage: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type ClinicPrivate = z.infer<typeof ClinicPrivateSchema>;

export const CLINIC_PHOTOS_MAX = 6;

/** `POST /clinics` (doctor). The creating doctor becomes the owner and is linked to it. */
export const CreateClinicRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: PhoneSchema.optional(),
    address: AddressSchema,
    location: LatLngSchema.optional(),
  })
  .strict();
export type CreateClinicRequest = z.infer<typeof CreateClinicRequestSchema>;

/** `PATCH /clinics/:id` (owner or a doctor of the clinic). `location: null` clears the pin. */
export const UpdateClinicRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: PhoneSchema.nullable().optional(),
    address: AddressSchema.optional(),
    location: LatLngSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });
export type UpdateClinicRequest = z.infer<typeof UpdateClinicRequestSchema>;

/** `POST /clinics/:id/staff`: adds the phone (creating the user if new) with role `clinic_staff`. */
export const AddStaffRequestSchema = z
  .object({
    phone: PhoneSchema,
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type AddStaffRequest = z.infer<typeof AddStaffRequestSchema>;

/** `GET /geo/geocode?city=&address=&state=&pincode=`: pin suggestions for the clinic form. */
export const GeocodeQuerySchema = z.object({
  city: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).optional(),
  state: z.string().trim().max(80).optional(),
  pincode: z
    .string()
    .regex(/^[1-9]\d{5}$/)
    .optional(),
});
export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;

export const GeocodeCandidateSchema = LatLngSchema.extend({
  label: z.string(),
  precision: z.enum(['exact', 'approximate']),
});
/** Empty `items` is normal: the doctor places the pin by hand. */
export const GeocodeResponseSchema = z.object({ items: z.array(GeocodeCandidateSchema) });
export type GeocodeResponse = z.infer<typeof GeocodeResponseSchema>;
