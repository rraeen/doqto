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
  .trim()
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

  /**
   * Login for the Doqto team (the admin area of the console). When both are set, the API creates or updates this team account
   * at every start, so changing them and restarting changes the login. Empty means "do not manage
   * an admin from .env" (use `pnpm --filter @doqto/api admin:create` instead).
   */
  ADMIN_EMAIL: z
    .string()
    .default('')
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'ADMIN_EMAIL must be an email address')
    .transform((v) => v || undefined),
  ADMIN_PASSWORD: z
    .string()
    .default('')
    .refine(
      (v) => v === '' || (v.length >= 10 && v.length <= 128 && /[A-Za-z]/.test(v) && /\d/.test(v)),
      'ADMIN_PASSWORD needs 10 or more characters with a letter and a number',
    )
    .transform((v) => v || undefined),
  ADMIN_NAME: z.string().trim().min(2).max(120).default('Doqto Admin'),

  /** Run the jobs worker and crons in this process (BE-19). Tests and one-off scripts set `false`. */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JOB_POLL_MS: z.coerce.number().int().min(200).max(60_000).default(5000),

  /**
   * Labs upload test reports into Doqto's storage. ADR 0007 keeps clinical data out until the
   * data-protection review is done, so this is off in live mode unless set to `true` on purpose.
   * Unset: on in demo mode, off otherwise.
   */
  LAB_REPORTS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),

  /** Web Push (INT-16). All three empty means no push; generate a pair with `npx web-push generate-vapid-keys`. */
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:contact@doqto.in'),

  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
});

export type Env = z.infer<typeof EnvSchema>;

/** Used by `ConfigModule.forRoot({ validate })`. Throws one readable error listing every problem. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    trimmed[key] = typeof value === 'string' ? value.trim() : value;
  }
  const parsed = EnvSchema.safeParse(trimmed);
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
  // Nest copies what this returns into process.env. Keep the variables the schema does not list
  // (RAZORPAY_*, R2_*, WhatsApp, SMS...): the integrations read them straight from process.env.
  return { ...trimmed, ...env } as Env;
}
