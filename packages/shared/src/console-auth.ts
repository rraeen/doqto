/**
 * Sign-in for the people who run a practice on Doqto (doctors and clinics, labs, pharmacies):
 * the console app. Patients use phone OTP (`auth.ts`); providers use a phone or an email plus a
 * password, verified once with a code at registration. Separate cookies, separate token audience.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, ObjectIdSchema, PHONE_E164_IN_REGEX } from './common';

/** What a person registers as. It decides their workspace and the profile form they fill in. */
export const WORKSPACE_TYPES = ['clinic', 'lab', 'pharmacy'] as const;
export const WorkspaceTypeSchema = z.enum(WORKSPACE_TYPES);
export type WorkspaceType = z.infer<typeof WorkspaceTypeSchema>;

export const ACCOUNT_CODE_LENGTH = 6;
export const ACCOUNT_CODE_TTL_SECONDS = 600;
export const ACCOUNT_CODE_MAX_ATTEMPTS = 5;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
/** Wrong passwords before the account is locked, and for how long. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

/** Cookie names set by the console auth routes (httpOnly). Different from the patient cookies. */
export const CONSOLE_ACCESS_COOKIE = 'doqto_ct';
export const CONSOLE_REFRESH_COOKIE = 'doqto_crt';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** A phone (E.164) or an email: how a provider is identified. Emails are compared lower-cased. */
export const IDENTIFIER_REGEX = new RegExp(`(?:${PHONE_E164_IN_REGEX.source})|(?:${EMAIL_REGEX.source})`);
export const IDENTIFIER_MESSAGE = 'Enter an email address or an Indian mobile number like +919876543210';

export const IdentifierSchema = z
  .string()
  .trim()
  .max(254)
  .refine((v) => PHONE_E164_IN_REGEX.test(v) || EMAIL_REGEX.test(v), IDENTIFIER_MESSAGE);

export const PASSWORD_MESSAGE = `Use ${PASSWORD_MIN_LENGTH} or more characters with at least one letter and one number`;
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_MESSAGE)
  .max(PASSWORD_MAX_LENGTH)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), PASSWORD_MESSAGE);

export const AccountCodeSchema = z.string().regex(/^\d{6}$/, 'Expected a 6-digit code');

/**
 * `POST /console/auth/register`: creates the account and its organization, and sends a code to the
 * phone or email. Which services the person runs (clinic, lab, pharmacy) is chosen after sign-in.
 */
export const ConsoleRegisterRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    identifier: IdentifierSchema,
    password: PasswordSchema,
    language: z.enum(['en', 'hi']).optional(),
  })
  .strict();
export type ConsoleRegisterRequest = z.infer<typeof ConsoleRegisterRequestSchema>;

/** A code was sent. `demo` means nothing was sent: use the demo code. */
export const CodeSentResponseSchema = z.object({
  expiresAt: IsoDateTimeSchema,
  channel: z.enum(['email', 'sms', 'demo']),
});
export type CodeSentResponse = z.infer<typeof CodeSentResponseSchema>;

/** `POST /console/auth/verify`: confirms the code and signs in. */
export const ConsoleVerifyRequestSchema = z
  .object({ identifier: IdentifierSchema, code: AccountCodeSchema })
  .strict();
export type ConsoleVerifyRequest = z.infer<typeof ConsoleVerifyRequestSchema>;

/** `POST /console/auth/resend` and `POST /console/auth/forgot-password`. */
export const ConsoleIdentifierRequestSchema = z.object({ identifier: IdentifierSchema }).strict();
export type ConsoleIdentifierRequest = z.infer<typeof ConsoleIdentifierRequestSchema>;

/** A staff member signs in with a username the owner chose, not a phone or an email. */
/** At least one letter, so a username can never be mistaken for a phone number. */
export const USERNAME_REGEX = /^(?=.*[a-z])[a-z0-9._]{4,30}$/;
export const USERNAME_MESSAGE =
  'Use 4 to 30 letters, numbers, dots or underscores, with at least one letter';
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, USERNAME_MESSAGE);

/** Who is signing in: a phone, an email, or (for staff) a username. */
export const LoginIdentifierSchema = z
  .string()
  .trim()
  .max(254)
  .refine(
    (v) => PHONE_E164_IN_REGEX.test(v) || EMAIL_REGEX.test(v) || USERNAME_REGEX.test(v.toLowerCase()),
    'Enter your phone, email or username',
  );

/** `POST /console/auth/login` */
export const ConsoleLoginRequestSchema = z
  .object({ identifier: LoginIdentifierSchema, password: z.string().min(1).max(PASSWORD_MAX_LENGTH) })
  .strict();
export type ConsoleLoginRequest = z.infer<typeof ConsoleLoginRequestSchema>;

/** `POST /console/auth/change-password`: a signed-in account sets a new password. */
export const ConsoleChangePasswordRequestSchema = z
  .object({ currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH), newPassword: PasswordSchema })
  .strict();
export type ConsoleChangePasswordRequest = z.infer<typeof ConsoleChangePasswordRequestSchema>;

/** `POST /console/auth/reset-password`: sets a new password with the code and signs out everywhere. */
export const ConsoleResetPasswordRequestSchema = z
  .object({ identifier: IdentifierSchema, code: AccountCodeSchema, newPassword: PasswordSchema })
  .strict();
export type ConsoleResetPasswordRequest = z.infer<typeof ConsoleResetPasswordRequestSchema>;

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;

/**
 * Where an application for a service (a unit) is. A person applies once through the application
 * form (`pending`); Doqto checks it. Only `verified` services open a dashboard and are listed on the
 * patient site. `draft` is a saved form that was never submitted.
 */
export const UNIT_STATUSES = [
  'draft',
  'pending',
  'changes_requested',
  'verified',
  'rejected',
  'suspended',
] as const;
export const UnitStatusSchema = z.enum(UNIT_STATUSES);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

/** What a person may do inside a unit. Owners have everything. */
export const MEMBER_ROLES = ['owner', 'staff'] as const;
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

/**
 * What an owner can switch on for a staff member, per kind of service. The dashboard is always
 * open to every member. Profile, settings, staff, applying for services and earnings are never on
 * this list: only the owner has them.
 */
export const PERMISSIONS_BY_KIND = {
  clinic: ['appointments', 'queue', 'messages', 'schedule', 'reviews'],
  lab: ['bookings', 'catalogue', 'collection', 'reports'],
  pharmacy: ['orders', 'products', 'dispatch'],
} as const satisfies Record<WorkspaceType, readonly string[]>;
export type StaffPermission = (typeof PERMISSIONS_BY_KIND)[WorkspaceType][number];

export const permissionsFor = (kind: WorkspaceType): readonly string[] => PERMISSIONS_BY_KIND[kind];

/** Whether a member may use `permission`: owners may use everything, staff only what was given. */
export function hasPermission(
  member: { role: MemberRole; permissions: readonly string[] },
  permission: string,
): boolean {
  return member.role === 'owner' || member.permissions.includes(permission);
}

/** One service (clinic, lab or pharmacy) the account applied for, and where that application is. */
export const WorkspaceSchema = z.object({
  id: ObjectIdSchema,
  organizationId: ObjectIdSchema,
  kind: WorkspaceTypeSchema,
  name: z.string(),
  status: UnitStatusSchema,
  role: MemberRoleSchema,
  /** What a staff member may use; empty for an owner, who may use everything. */
  permissions: z.array(z.string()),
  /** What Doqto told the applicant when sending the application back or rejecting it. */
  reviewNote: z.string().nullable(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** One service with the answers to its application form (`GET /console/workspaces/:id`). */
export const WorkspaceDetailSchema = WorkspaceSchema.extend({
  profile: z.record(z.string(), z.unknown()),
});
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;

/** The signed-in provider account. Never contains the password or codes. */
export const ConsoleAccountSchema = z.object({
  id: ObjectIdSchema,
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Set for staff accounts created by an owner; they sign in with it. */
  username: z.string().nullable(),
  /** The owner set a temporary password: the person must choose their own before anything else. */
  mustChangePassword: z.boolean(),
  language: z.enum(['en', 'hi']),
  status: z.enum(ACCOUNT_STATUSES),
  /** `admin` for a member of the Doqto team: the console shows the admin area for them. */
  platformRole: z.enum(['admin']).nullable(),
  /** The services this account applied for. One approved service goes straight to its dashboard. */
  workspaces: z.array(WorkspaceSchema),
});
export type ConsoleAccount = z.infer<typeof ConsoleAccountSchema>;

export const ConsoleSessionSchema = z.object({
  account: ConsoleAccountSchema,
  accessTokenExpiresAt: IsoDateTimeSchema,
});
export type ConsoleSession = z.infer<typeof ConsoleSessionSchema>;

/** Refresh result: only expiry times; the tokens themselves travel in httpOnly cookies. */
export const ConsoleRefreshResponseSchema = z.object({
  accessTokenExpiresAt: IsoDateTimeSchema,
  refreshTokenExpiresAt: IsoDateTimeSchema,
});
export type ConsoleRefreshResponse = z.infer<typeof ConsoleRefreshResponseSchema>;

/** A staff member of one service, as the owner sees them. */
export const StaffMemberSchema = z.object({
  accountId: ObjectIdSchema,
  name: z.string(),
  username: z.string(),
  permissions: z.array(z.string()),
  status: z.enum(ACCOUNT_STATUSES),
  mustChangePassword: z.boolean(),
  lastLoginAt: IsoDateTimeSchema.nullable(),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const StaffListSchema = z.object({ items: z.array(StaffMemberSchema) });
export type StaffList = z.infer<typeof StaffListSchema>;

const PermissionListSchema = z.array(z.string().min(1).max(40)).max(20);

/**
 * `POST /console/workspaces/:id/staff`: the owner creates a staff login and picks what it can use.
 * If the username already belongs to a staff member of the same business, that person is added to
 * this service instead (their password is left alone).
 */
export const CreateStaffRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    username: UsernameSchema,
    password: PasswordSchema,
    permissions: PermissionListSchema,
  })
  .strict();
export type CreateStaffRequest = z.infer<typeof CreateStaffRequestSchema>;

/** `PATCH /console/workspaces/:id/staff/:accountId` */
export const UpdateStaffRequestSchema = z
  .object({ name: z.string().trim().min(2).max(120).optional(), permissions: PermissionListSchema.optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.permissions !== undefined, 'Nothing to change');
export type UpdateStaffRequest = z.infer<typeof UpdateStaffRequestSchema>;

/** `POST /console/workspaces/:id/staff/:accountId/reset-password`: a new temporary password. */
export const ResetStaffPasswordRequestSchema = z.object({ password: PasswordSchema }).strict();
export type ResetStaffPasswordRequest = z.infer<typeof ResetStaffPasswordRequestSchema>;

/** Claims in the console access JWT. `aud` keeps it from working on patient routes. */
export const CONSOLE_AUDIENCE = 'console';
