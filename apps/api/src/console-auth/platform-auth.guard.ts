import { CONSOLE_ACCESS_COOKIE, CONSOLE_AUDIENCE } from '@doqto/shared';
import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { Account } from './account.schema';

export interface PlatformUser {
  id: string;
  name: string;
}

type PlatformRequest = Request & { platformUser?: PlatformUser };

function token(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[CONSOLE_ACCESS_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

/**
 * Guards the Doqto team's routes. The team signs in to the same console as everyone else, so the
 * token is an ordinary console token; what makes the difference is the account's `admin` role,
 * which is checked in the database on every request. Removing the role takes effect at once rather
 * than when the token expires, and a provider's token never passes.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    const presented = token(req);
    if (!presented) throw AppException.unauthenticated();
    let sub: string;
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: unknown }>(presented, {
        algorithms: ['HS256'],
        audience: CONSOLE_AUDIENCE,
      });
      if (typeof claims.sub !== 'string' || !Types.ObjectId.isValid(claims.sub))
        throw new Error('sub');
      sub = claims.sub;
    } catch {
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }
    const account = await this.accounts
      .findById(sub, { name: 1, status: 1, platformRole: 1 })
      .exec();
    if (!account || account.status !== 'active') throw AppException.unauthenticated();
    // A signed-in provider is not an admin: say so plainly rather than pretend nobody is signed in.
    if (account.platformRole !== 'admin')
      throw AppException.forbidden('This is for the Doqto team');
    req.platformUser = { id: sub, name: account.name };
    return true;
  }
}

/** The signed-in team member on a route behind `PlatformAuthGuard`. */
export const CurrentPlatformUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PlatformUser => {
    const user = ctx.switchToHttp().getRequest<PlatformRequest>().platformUser;
    if (!user) throw new Error('CurrentPlatformUser used without PlatformAuthGuard');
    return user;
  },
);
