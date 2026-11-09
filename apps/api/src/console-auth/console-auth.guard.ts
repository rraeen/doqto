import { CONSOLE_ACCESS_COOKIE, CONSOLE_AUDIENCE } from '@doqto/shared';
import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/http/app-exception';

export interface ConsoleUser {
  id: string;
}

type ConsoleRequest = Request & { consoleUser?: ConsoleUser };

function token(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[CONSOLE_ACCESS_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

/**
 * Guards routes for signed-in providers. Accepts only access tokens issued for the console
 * audience, so a patient token (no audience) never opens a console route, and the other way round
 * (the global patient guard refuses any token that has an audience).
 */
@Injectable()
export class ConsoleAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ConsoleRequest>();
    const presented = token(req);
    if (!presented) throw AppException.unauthenticated();
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: unknown }>(presented, {
        algorithms: ['HS256'],
        audience: CONSOLE_AUDIENCE,
      });
      if (typeof claims.sub !== 'string') throw new Error('no subject');
      req.consoleUser = { id: claims.sub };
      return true;
    } catch {
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }
  }
}

/** The signed-in provider account id on a route behind `ConsoleAuthGuard`. */
export const CurrentConsoleUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ConsoleUser => {
    const user = ctx.switchToHttp().getRequest<ConsoleRequest>().consoleUser;
    if (!user) throw new Error('CurrentConsoleUser used without ConsoleAuthGuard');
    return user;
  },
);
