import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';

// One `.env` at the repo root serves every app (see the root `.env.example`). Next has already
// loaded the env of this app folder, which has no `.env`, so the root file is force-loaded.
for (const dir of new Set([
  path.resolve(__dirname, '../..'),
  path.resolve(process.cwd(), '../..'),
])) {
  loadEnvConfig(dir, process.env.NODE_ENV !== 'production', undefined, true);
}

// The browser calls `/api/v1` on this host and Next proxies it to the API, so cookies stay
// first-party and host-only (infra/ENVIRONMENTS.md, cookie isolation).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

const devOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// A work tool, not a public site: never indexed, never framed, no referrer leaks.
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  allowedDevOrigins: devOrigins,
  rewrites: async () =>
    apiProxyTarget
      ? [{ source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` }]
      : [],
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@doqto/shared', '@doqto/ui', '@doqto/api-client', '@doqto/i18n'],
  turbopack: { root: path.resolve(__dirname, '../..') },
};

export default nextConfig;
