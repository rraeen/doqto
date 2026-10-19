import type { Role } from '@doqto/shared';

/** What `JwtAuthGuard` attaches to `req.user`. */
export interface AuthUser {
  id: string;
  roles: Role[];
}

export interface AuthedRequest {
  user?: AuthUser;
}
