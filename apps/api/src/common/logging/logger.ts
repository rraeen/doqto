import { RequestMethod } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env';

/** Keys that must never reach a log line (Definition of Done; TDD 11). */
export const REDACT_KEYS = [
  'phone',
  'patientPhone',
  'otp',
  'code',
  'codeHash',
  'visitCode',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'authorization',
  'cookie',
  'password',
  'secret',
] as const;

/** Pino redact paths: the keys at the top level and up to three levels deep, plus HTTP headers. */
export function redactPaths(): string[] {
  const paths: string[] = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'req.query.phone',
  ];
  for (const key of REDACT_KEYS) {
    paths.push(key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`);
  }
  return paths;
}

export function loggerParams(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Params {
  return {
    // Nest 11 route syntax; the default '*' triggers a legacy-route warning.
    forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: env.LOG_LEVEL,
      redact: { paths: redactPaths(), censor: '[redacted]' },
      genReqId: (req: IncomingMessage) => {
        const incoming = req.headers['x-request-id'];
        return typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming)
          ? incoming
          : randomUUID();
      },
      // Query strings can carry search terms; keep the path only.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url.split('?')[0],
        }),
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
