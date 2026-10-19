import {
  ACCESS_TOKEN_COOKIE,
  API_PREFIX,
  REFRESH_TOKEN_COOKIE,
  type TokenPair,
} from '@doqto/shared';

/** A pair as issued by TokenService: both tokens always present. */
export type IssuedTokens = TokenPair & { accessToken: string; refreshToken: string };
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../config/app-config.service';

/** Refresh cookie is only sent to the auth routes. */
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

function base(config: AppConfig): CookieOptions {
  // SameSite=Lax: cookies are not sent on cross-site POSTs, which covers CSRF for the
  // cookie-authenticated web app (CORS is also limited to CORS_ORIGINS).
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    domain: config.get('COOKIE_DOMAIN'),
  };
}

export function setAuthCookies(res: Response, config: AppConfig, pair: IssuedTokens): void {
  res.cookie(ACCESS_TOKEN_COOKIE, pair.accessToken, {
    ...base(config),
    path: '/',
    expires: new Date(pair.accessTokenExpiresAt),
  });
  res.cookie(REFRESH_TOKEN_COOKIE, pair.refreshToken, {
    ...base(config),
    path: REFRESH_COOKIE_PATH,
    expires: new Date(pair.refreshTokenExpiresAt),
  });
}

export function clearAuthCookies(res: Response, config: AppConfig): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base(config), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base(config), path: REFRESH_COOKIE_PATH });
}

/** Body token (mobile) wins over the cookie (web). */
export function presentedRefreshToken(req: Request, bodyToken?: string): string | undefined {
  if (bodyToken) return bodyToken;
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_TOKEN_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}
