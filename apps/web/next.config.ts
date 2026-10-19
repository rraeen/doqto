import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';

// One `.env` at the repo root serves every app (see the root `.env.example`).
loadEnvConfig(path.resolve(__dirname, '../..'));

// Demo: the browser calls `/api/v1` on the web host and Next proxies it to the API, so auth
// cookies stay first-party (Safari) and host-only (infra/ENVIRONMENTS.md, cookie isolation).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

// Doctor and clinic photos are optimised by next/image only from the public R2 bucket (INT-06).
const photoHost = process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL) : null;

const nextConfig: NextConfig = {
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
  // `@doqto/shared` is consumed as TypeScript source through the tsconfig path alias.
  transpilePackages: ['@doqto/shared'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
    // `msw/browser` exports nothing for Node; give the SSR pass a stub (see the stub file).
    resolveAlias: {
      'msw/browser': { browser: 'msw/browser', default: './src/mocks/msw-browser-ssr-stub.ts' },
    },
  },
};

export default nextConfig;
