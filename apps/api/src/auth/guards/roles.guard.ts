import type { Role } from '@doqto/shared';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/http/app-exception';
import type { AuthedRequest } from '../auth.types';
import { ROLES_KEY } from '../decorators';

/** Global guard enforcing `@Roles(...)`. Routes without `@Roles` only need a logged-in user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw AppException.unauthenticated();
    if (!required.some((r) => user.roles.includes(r))) throw AppException.forbidden();
    return true;
  }
}
