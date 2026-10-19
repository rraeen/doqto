import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/http/app-exception';
import type { AuthUser } from '../auth.types';
import { Roles } from '../decorators';
import { RolesGuard } from './roles.guard';

class Fixture {
  @Roles('admin')
  adminOnly() {}

  open() {}
}

function ctx(handler: () => void, user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Fixture,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = Fixture.prototype;

  it('lets any logged-in user through routes without @Roles', () => {
    expect(guard.canActivate(ctx(proto.open, { id: 'u', roles: ['patient'] }))).toBe(true);
  });

  it('requires one of the listed roles', () => {
    expect(guard.canActivate(ctx(proto.adminOnly, { id: 'u', roles: ['patient', 'admin'] }))).toBe(
      true,
    );
    expect(() => guard.canActivate(ctx(proto.adminOnly, { id: 'u', roles: ['doctor'] }))).toThrow(
      AppException,
    );
  });

  it('rejects anonymous callers on role-restricted routes', () => {
    try {
      guard.canActivate(ctx(proto.adminOnly));
      throw new Error('expected rejection');
    } catch (e) {
      expect((e as AppException).code).toBe('UNAUTHENTICATED');
    }
  });
});
