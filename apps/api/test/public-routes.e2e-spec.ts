import { type INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../src/common/http/public';
import { createTestApp } from './app';

/**
 * Exactly these routes may be reached without a token (RD BE-04 blocker). A new `@Public()`
 * route fails this test until it is added here on purpose.
 */
const PUBLIC_ROUTES = [
  'GET /health',
  'POST /auth/otp/request',
  'POST /auth/otp/verify',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /doctors',
  'GET /doctors/:slug',
  'GET /doctors/:id/status',
  'POST /webhooks/payments',
  'POST /webhooks/razorpay',
  'GET /demo-storage/public/*key',
  'GET /demo-storage/private/*key',
];
type Route = { route: string; isPublic: boolean };

function listRoutes(app: INestApplication): Route[] {
  const reflector = app.get(Reflector);
  const routes: Route[] = [];
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const cls = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!cls) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, cls) ?? '');
      const proto = cls.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const sub: unknown = Reflect.getMetadata(PATH_METADATA, handler);
        if (sub === undefined) continue;
        const method =
          RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        for (const p of Array.isArray(sub) ? (sub as string[]) : [String(sub)]) {
          const path = `/${[base, p].join('/')}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
          const isPublic =
            reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, cls]) === true;
          routes.push({ route: `${method} ${path}`, isPublic });
        }
      }
    }
  }
  return routes;
}

describe('public route allowlist', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('only the allowlisted routes skip the auth guard', () => {
    const routes = listRoutes(app);
    expect(routes.length).toBeGreaterThan(20);
    const unexpected = routes.filter((r) => r.isPublic && !PUBLIC_ROUTES.includes(r.route));
    expect(unexpected.map((r) => r.route)).toEqual([]);
    const missing = PUBLIC_ROUTES.filter((r) => !routes.some((x) => x.route === r && x.isPublic));
    expect(missing).toEqual([]);
  });
});
