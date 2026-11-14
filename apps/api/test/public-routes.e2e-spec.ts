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
  // Provider (console) sign-in has its own guard; /me behind it checks a console token itself.
  'POST /console/auth/register',
  'POST /console/auth/resend',
  'POST /console/auth/verify',
  'POST /console/auth/login',
  'POST /console/auth/forgot-password',
  'POST /console/auth/reset-password',
  'POST /console/auth/refresh',
  'POST /console/auth/logout',
  'GET /console/auth/me',
  'GET /console/workspaces',
  'POST /console/applications',
  // The Doqto team's review of applications: its own guard (console token plus the admin role).
  'GET /platform/applications',
  'GET /platform/applications/:id',
  'POST /platform/applications/:id/decision',
  'GET /console/workspaces/:id',
  'POST /console/auth/change-password',
  'GET /console/workspaces/:unitId/staff',
  'POST /console/workspaces/:unitId/staff',
  'PATCH /console/workspaces/:unitId/staff/:accountId',
  'POST /console/workspaces/:unitId/staff/:accountId/reset-password',
  'DELETE /console/workspaces/:unitId/staff/:accountId',
  'GET /labs',
  'GET /labs/:slug',
  'GET /console/workspaces/:unitId/lab/catalogue',
  'POST /console/workspaces/:unitId/lab/categories',
  'POST /console/workspaces/:unitId/lab/tests',
  'PATCH /console/workspaces/:unitId/lab/tests/:testId',
  'GET /console/workspaces/:unitId/lab/bookings',
  'GET /console/workspaces/:unitId/lab/collectors',
  'POST /console/workspaces/:unitId/lab/bookings/:bookingId/decision',
  'POST /console/workspaces/:unitId/lab/bookings/:bookingId/progress',
  'PUT /console/workspaces/:unitId/lab/bookings/:bookingId/assignee',
  'PUT /console/workspaces/:unitId/lab/bookings/:bookingId/report',
  'GET /console/workspaces/:id/schedule',
  'PUT /console/workspaces/:id/schedule',
  'GET /console/workspaces/:id/profile',
  'PUT /console/workspaces/:id/profile',
  'PUT /console/workspaces/:id/profile/photo',
  'DELETE /console/workspaces/:id/profile',
  'GET /platform/profile-changes',
  'GET /platform/profile-changes/:id',
  'POST /platform/profile-changes/:id/decision',
  'GET /console/workspaces/:unitId/appointments',
  'GET /console/workspaces/:unitId/appointments/waiting',
  'GET /console/workspaces/:unitId/appointments/upcoming',
  'POST /console/workspaces/:unitId/appointments/:id/confirm',
  'POST /console/workspaces/:unitId/appointments',
  'GET /console/workspaces/:unitId/chats',
  'GET /console/workspaces/:unitId/chats/:appointmentId',
  'POST /console/workspaces/:unitId/chats/:appointmentId',
  'POST /console/workspaces/:unitId/queue/check-in',
  'POST /console/workspaces/:unitId/queue/next',
  'POST /console/workspaces/:unitId/queue/:appointmentId/send-otp',
  'POST /console/workspaces/:unitId/queue/:appointmentId/no-show',
  'POST /console/workspaces/:unitId/queue/:appointmentId/move',
  'PUT /console/workspaces/:unitId/status',
  'GET /doctors',
  'GET /doctors/:slug',
  'GET /doctors/:id/status',
  'GET /doctors/:id/reviews',
  'GET /transparency',
  'POST /webhooks/payments',
  'POST /webhooks/razorpay',
  // Meta WhatsApp: GET answers the verify-token handshake, POST checks the HMAC signature.
  'GET /webhooks/whatsapp',
  'POST /webhooks/whatsapp',
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
