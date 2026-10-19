import { ACCESS_TOKEN_COOKIE, ROLES, type Role } from '@doqto/shared';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../../common/http/app-exception';
import type { AuthedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators';

interface AccessClaims {
  sub: string;
  roles: string[];
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[ACCESS_TOKEN_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

/**
 * Global guard: every route needs a valid access JWT (Bearer header for mobile, `doqto_at`
 * cookie for web) unless marked `@Public()`. Stateless: suspension takes effect at the next
 * refresh (at most 15 minutes) and immediately on `/me`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])
    )
      return true;
    const req = ctx.switchToHttp().getRequest<Request & AuthedRequest>();
    const token = bearer(req);
    if (!token) throw AppException.unauthenticated();
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token, { algorithms: ['HS256'] });
    } catch {
      throw AppException.unauthenticated('Your session has expired. Please log in again.');
    }
    if (typeof claims.sub !== 'string' || !Array.isArray(claims.roles))
      throw AppException.unauthenticated();
    req.user = {
      id: claims.sub,
      roles: claims.roles.filter((r): r is Role => (ROLES as readonly string[]).includes(r)),
    };
    return true;
  }
}
