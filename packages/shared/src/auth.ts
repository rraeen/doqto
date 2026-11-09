import { z } from 'zod';
import { IsoDateTimeSchema, PhoneSchema } from './common';
import { RoleSchema } from './enums';
import { MeSchema } from './me';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;
/** OTP requests allowed per phone and, separately, per IP, in `OTP_REQUEST_WINDOW_SECONDS`. */
export const OTP_REQUEST_LIMIT = 10;
export const OTP_REQUEST_WINDOW_SECONDS = 600;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Cookie names set by `otp/verify` and `refresh` for web clients (httpOnly). */
export const ACCESS_TOKEN_COOKIE = 'doqto_at';
export const REFRESH_TOKEN_COOKIE = 'doqto_rt';

export const OTP_CODE_REGEX = /^\d{6}$/;
export const OtpCodeSchema = z.string().regex(OTP_CODE_REGEX, 'Expected a 6-digit code');

/** `POST /auth/otp/request` */
export const OtpRequestSchema = z
  .object({
    phone: PhoneSchema,
    purpose: z.literal('login').default('login'),
  })
  .strict();
export type OtpRequest = z.input<typeof OtpRequestSchema>;

export const OtpRequestResponseSchema = z.object({
  /** When this OTP stops working. */
  expiresAt: IsoDateTimeSchema,
  /** How the code was sent. `demo` means nothing was sent: use the demo code. */
  channel: z.enum(['whatsapp', 'sms', 'demo']),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

/** `POST /auth/otp/verify` */
export const OtpVerifyRequestSchema = z
  .object({
    phone: PhoneSchema,
    code: OtpCodeSchema,
    /** Stable per-install id from the client, used to label refresh tokens. Optional. */
    deviceId: z.string().min(1).max(128).optional(),
    /**
     * WhatsApp consent from the signup screen. Applied only when this login creates the
     * account (and logged in `consentLog`); existing users change it with `PATCH /me`.
     */
    whatsappOptIn: z.boolean().optional(),
  })
  .strict();
export type OtpVerifyRequest = z.infer<typeof OtpVerifyRequestSchema>;

/**
 * Native clients send this header (value `mobile`) on `otp/verify` and `refresh` to receive the
 * tokens in the JSON body. Without it (the web app) tokens travel only in httpOnly cookies, so
 * page JavaScript can never read the 30-day refresh token.
 */
export const CLIENT_HEADER = 'x-doqto-client';
export const MOBILE_CLIENT = 'mobile';

/**
 * Token pair. `accessToken` and `refreshToken` are present only for mobile clients
 * (`X-Doqto-Client: mobile`); the expiry times are always present.
 */
export const TokenPairSchema = z.object({
  accessToken: z.string().optional(),
  accessTokenExpiresAt: IsoDateTimeSchema,
  refreshToken: z.string().optional(),
  refreshTokenExpiresAt: IsoDateTimeSchema,
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const OtpVerifyResponseSchema = TokenPairSchema.extend({
  user: MeSchema,
  /** True when this login created the account (show onboarding: name, language). */
  isNewUser: z.boolean(),
});
export type OtpVerifyResponse = z.infer<typeof OtpVerifyResponseSchema>;

/**
 * `POST /auth/refresh` and `POST /auth/logout`. Mobile sends `refreshToken` in the body;
 * web sends an empty body and the API reads the `doqto_rt` cookie.
 */
export const RefreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1).max(512).optional(),
  })
  .strict();
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = TokenPairSchema;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const LogoutRequestSchema = RefreshRequestSchema;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

/** Claims inside the access JWT. `sub` is the user id. */
export const AccessTokenClaimsSchema = z.object({
  sub: z.string(),
  roles: z.array(RoleSchema),
  iat: z.number(),
  exp: z.number(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;
