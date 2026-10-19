import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Environment for e2e tests. Must load before AppModule is imported (ConfigModule validates at import).
process.env.NODE_ENV = 'test';
process.env.PROVIDER_MODE ??= 'demo';
process.env.LOG_LEVEL ??= 'silent';
process.env.APP_VERSION ??= 'test';
process.env.JOBS_ENABLED ??= 'false';
// A fresh database per test file (setupFiles run once per file).
process.env.MONGODB_DB_NAME = `doqto_demo_test_${Math.random().toString(36).slice(2, 10)}`;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.HASH_PEPPER ??= 'test-hash-pepper-value';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.THROTTLE_LIMIT ??= '1000';
// Lets tests vary the client IP with X-Forwarded-For (per-IP OTP limits).
process.env.TRUST_PROXY ??= '1';
// Demo storage writes uploads to disk; keep them out of the repo.
process.env.DEMO_STORAGE_DIR ??= join(tmpdir(), 'doqto-test-storage');
