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

/** `POST /console/auth/login` */
export const ConsoleLoginRequestSchema = z
  .object({ identifier: IdentifierSchema, password: z.string().min(1).max(PASSWORD_MAX_LENGTH) })
  .strict();
export type ConsoleLoginRequest = z.infer<typeof ConsoleLoginRequestSchema>;

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

/** One service (clinic, lab or pharmacy) the account applied for, and where that application is. */
export const WorkspaceSchema = z.object({
  id: ObjectIdSchema,
  organizationId: ObjectIdSchema,
  kind: WorkspaceTypeSchema,
  name: z.string(),
  status: UnitStatusSchema,
  role: MemberRoleSchema,
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

/** Claims in the console access JWT. `aud` keeps it from working on patient routes. */
export const CONSOLE_AUDIENCE = 'console';
