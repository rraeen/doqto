import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';

// One `.env` at the repo root serves every app (see the root `.env.example`).
// Next has already loaded (and cached) the env of this app folder, which has no `.env`, before it
// evaluates this file, so the root file is loaded with `forceReload`. `__dirname` is not reliable
// once Next has transpiled this file, so the working directory (apps/web) is tried as well.
for (const dir of new Set([
  path.resolve(__dirname, '../..'),
  path.resolve(process.cwd(), '../..'),
])) {
  loadEnvConfig(dir, process.env.NODE_ENV !== 'production', undefined, true);
}

// Demo: the browser calls `/api/v1` on the web host and Next proxies it to the API, so auth
// cookies stay first-party (Safari) and host-only (infra/ENVIRONMENTS.md, cookie isolation).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

// Doctors, clinics, labs and pharmacies work in the console app; old links to /for-doctors go to
// its front page.
const consoleUrl = (process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3010').replace(/\/$/, '');

// Hosts allowed to load the dev server, for testing from a phone on the same Wi-Fi, e.g.
// ALLOWED_DEV_ORIGINS=192.168.1.19. Without it Next blocks the dev scripts and the page never hydrates.
const devOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Doctor and clinic photos are optimised by next/image only from the public R2 bucket (INT-06).
const photoHost = process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL) : null;

const nextConfig: NextConfig = {
  // `NEXT_DIST_DIR` lets a production build sit beside a running dev server (testing the PWA).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  headers: async () => [
    {
      // The worker must always be fetched fresh so updates reach installed apps.
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
  allowedDevOrigins: devOrigins,
  redirects: async () => [{ source: '/for-doctors', destination: consoleUrl, permanent: false }],
  images: {
    remotePatterns: photoHost
      ? [
          {
            protocol: photoHost.protocol === 'http:' ? 'http' : 'https',
            hostname: photoHost.hostname,
          },
        ]
      : [],
  },
  rewrites: async () =>
    apiProxyTarget
      ? [{ source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` }]
      : [],
  reactStrictMode: true,
  poweredByHeader: false,
  // `@doqto/shared` is consumed as TypeScript source through the tsconfig path alias; `@doqto/ui` is
  // workspace source, compiled by Next.
  transpilePackages: ['@doqto/shared', '@doqto/ui', '@doqto/api-client', '@doqto/i18n'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
    // `msw/browser` exports nothing for Node; give the SSR pass a stub (see the stub file).
    resolveAlias: {
      'msw/browser': { browser: 'msw/browser', default: './src/mocks/msw-browser-ssr-stub.ts' },
    },
  },
};

export default nextConfig;
