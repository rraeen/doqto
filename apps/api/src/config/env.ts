import { ProviderModeSchema } from '@doqto/shared';
import { z } from 'zod';
import { providerSafetyProblems } from '../integrations/provider-safety';

/**
 * Every environment variable the API reads, validated once at startup. A missing or
 * malformed variable stops the process before it listens (BE-01). Names match the root
 * `.env.example`, which INT owns.
 */
const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'Expected a duration like 15m')
  .transform((v) => {
    const n = Number(v.slice(0, -1));
    const unit = v.slice(-1) as 's' | 'm' | 'h' | 'd';
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  });

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_VERSION: z.string().min(1).default('dev'),
  PROVIDER_MODE: ProviderModeSchema,

  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  /** Patient web app origin, for links in WhatsApp messages (live status, rebook). */
  WEB_PUBLIC_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: csv,
  COOKIE_DOMAIN: z
    .string()
    .default('')
    .transform((v) => v || undefined),
  /** Number of proxies in front of the API (Cloudflare + Render = 2). `0` disables trust proxy. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** Header carrying the real client IP, e.g. `cf-connecting-ip` behind Cloudflare. Empty uses req.ip. */
  CLIENT_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Expected a lowercase header name')
    .default('')
    .transform((v) => v || undefined),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'Expected a mongodb:// or mongodb+srv:// URI'),
  MONGODB_DB_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,63}$/, 'Expected a plain database name'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: duration.default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  HASH_PEPPER: z.string().min(16, 'HASH_PEPPER must be at least 16 characters'),

  /** Run the jobs worker and crons in this process (BE-19). Tests and one-off scripts set `false`. */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JOB_POLL_MS: z.coerce.number().int().min(200).max(60_000).default(5000),

  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
});

export type Env = z.infer<typeof EnvSchema>;

/** Used by `ConfigModule.forRoot({ validate })`. Throws one readable error listing every problem. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  // TDD 13 demo safety (INT-03), checked here too so the API refuses before Mongoose connects.
  const env = parsed.data;
  const unsafe = providerSafetyProblems(
    {
      mode: env.PROVIDER_MODE,
      nodeEnv: env.NODE_ENV,
      mongodbUri: env.MONGODB_URI,
      mongodbDbName: env.MONGODB_DB_NAME,
    },
    [],
  );
  if (unsafe.length > 0) {
    throw new Error(
      `Refusing to start (TDD 13 demo safety):\n${unsafe.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return env;
}
