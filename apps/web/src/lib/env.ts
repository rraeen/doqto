// NEXT_PUBLIC_* values are inlined at build time, so each is read with a literal key.
export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, ''),
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  apiMocks: process.env.NEXT_PUBLIC_API_MOCKS === 'true',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
} as const;
