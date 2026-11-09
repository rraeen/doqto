import { API_PREFIX, CONSOLE_ACCESS_COOKIE, CONSOLE_REFRESH_COOKIE } from '@doqto/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../config/app-config.service';
import type { AccountTokens } from './account-session.service';

/** The refresh cookie is only sent to the console auth routes. */
export const CONSOLE_REFRESH_COOKIE_PATH = `${API_PREFIX}/console/auth`;

function base(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    domain: config.get('COOKIE_DOMAIN'),
  };
}

export function setConsoleCookies(res: Response, config: AppConfig, t: AccountTokens): void {
  res.cookie(CONSOLE_ACCESS_COOKIE, t.accessToken, {
    ...base(config),
    path: '/',
    expires: new Date(t.accessTokenExpiresAt),
  });
  res.cookie(CONSOLE_REFRESH_COOKIE, t.refreshToken, {
    ...base(config),
    path: CONSOLE_REFRESH_COOKIE_PATH,
    expires: new Date(t.refreshTokenExpiresAt),
  });
}

export function clearConsoleCookies(res: Response, config: AppConfig): void {
  res.clearCookie(CONSOLE_ACCESS_COOKIE, { ...base(config), path: '/' });
  res.clearCookie(CONSOLE_REFRESH_COOKIE, { ...base(config), path: CONSOLE_REFRESH_COOKIE_PATH });
}

export function presentedConsoleRefresh(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[CONSOLE_REFRESH_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}
