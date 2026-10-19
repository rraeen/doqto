import type { Role } from '@doqto/shared';
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthedRequest, AuthUser } from './auth.types';

export { IS_PUBLIC_KEY, Public } from '../common/http/public';

export const ROLES_KEY = 'doqto:roles';

/** Allow only users holding at least one of these roles (checked by the global `RolesGuard`). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** The authenticated user (`{ id, roles }`) on a non-public route. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new Error('CurrentUser used on a public route');
  return user;
});
