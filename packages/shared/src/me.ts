import { z } from 'zod';
import { IsoDateTimeSchema, ObjectIdSchema, PhoneSchema } from './common';
import { LanguageSchema, RoleSchema, UserStatusSchema } from './enums';

export const NAME_MAX = 80;

/** `GET /me`, `PATCH /me` response, and `user` in the login response. */
export const MeSchema = z.object({
  id: ObjectIdSchema,
  phone: PhoneSchema,
  /** `null` until the user sets it (first login creates the account without a name). */
  name: z.string().nullable(),
  roles: z.array(RoleSchema),
  language: LanguageSchema,
  whatsappOptIn: z.boolean(),
  status: UserStatusSchema,
  /** Clinics where the user is staff (role `clinic_staff`). */
  clinicIds: z.array(ObjectIdSchema),
  /** True for accounts created in demo mode. */
  isDemo: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type Me = z.infer<typeof MeSchema>;

/** `PATCH /me`. At least one field. Unknown fields are rejected. */
export const UpdateMeRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX).optional(),
    language: LanguageSchema.optional(),
    whatsappOptIn: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field' });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

/**
 * Version of the consent text shown with the WhatsApp checkbox. Recorded in `users.consentLog`
 * whenever consent is given or withdrawn; bump it when the wording changes.
 */
export const WHATSAPP_CONSENT_VERSION = 'whatsapp-2026-10';
