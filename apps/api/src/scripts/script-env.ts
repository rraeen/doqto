import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Imported first by one-off scripts, before AppModule validates the environment:
// a script must never start the jobs worker or crons.
// Nest has not loaded dotenv yet when seed-demo calls validateEnv(process.env).
// Same search order as ConfigModule (cwd .env wins; repo-root .env fills gaps).
for (const rel of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), rel);
  if (existsSync(path)) process.loadEnvFile(path);
}
process.env.JOBS_ENABLED = 'false';
