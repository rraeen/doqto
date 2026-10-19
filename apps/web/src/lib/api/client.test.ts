import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadWith(apiUrl: string) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', apiUrl);
  vi.resetModules();
  return import('./client');
}

describe('buildUrl', () => {
  it('uses an absolute API URL as is', async () => {
    const { buildUrl } = await loadWith('http://localhost:4000/api/v1');
    expect(buildUrl('/me', { cursor: 'abc', limit: 20, skip: undefined })).toBe(
      'http://localhost:4000/api/v1/me?cursor=abc&limit=20',
    );
  });

  it('resolves the same-origin demo path against the page origin', async () => {
    const { buildUrl } = await loadWith('/api/v1/');
    expect(buildUrl('/auth/refresh', undefined, 'https://doqto-web-demo.vercel.app')).toBe(
      'https://doqto-web-demo.vercel.app/api/v1/auth/refresh',
    );
  });
});

describe('refresh single-flight', () => {
  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const unauthenticated = () =>
    new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'x' } }), {
      status: 401,
    });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('refreshes once for parallel 401s and retries each request', async () => {
    const { apiRequest } = await loadWith('http://localhost:4000/api/v1');
    const { z } = await import('zod');
    let refreshed = false;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        calls.push(path);
        if (path.endsWith('/auth/refresh')) {
          refreshed = true;
          return ok({});
        }
        return refreshed ? ok({ n: 1 }) : unauthenticated();
      }),
    );
    const schema = z.object({ n: z.number() });
    const results = await Promise.all([1, 2, 3].map(() => apiRequest('/me', { schema })));
    expect(results).toEqual([{ n: 1 }, { n: 1 }, { n: 1 }]);
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('skips its own refresh when another tab rotated after the request was sent', async () => {
    const { apiRequest, REFRESH_MARK_KEY } = await loadWith('http://localhost:4000/api/v1');
    const { z } = await import('zod');
    let first = true;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        calls.push(path);
        if (first) {
          first = false;
          // Another tab rotates the cookie while this request is in flight.
          localStorage.setItem(REFRESH_MARK_KEY, String(Date.now() + 1));
          return unauthenticated();
        }
        return ok({ n: 2 });
      }),
    );
    await expect(apiRequest('/me', { schema: z.object({ n: z.number() }) })).resolves.toEqual({
      n: 2,
    });
    expect(calls.some((c) => c.endsWith('/auth/refresh'))).toBe(false);
  });

  it('retries the request when its refresh lost a race, and fails on a real REFRESH_INVALID', async () => {
    const { apiRequest } = await loadWith('http://localhost:4000/api/v1');
    const { z } = await import('zod');
    const refreshInvalid = (raced: boolean) =>
      new Response(
        JSON.stringify({ error: { code: 'REFRESH_INVALID', message: 'x', details: { raced } } }),
        { status: 401 },
      );
    let raced = true;
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (new URL(url).pathname.endsWith('/auth/refresh')) return refreshInvalid(raced);
        attempt += 1;
        return attempt % 2 === 0 ? ok({ n: 3 }) : unauthenticated();
      }),
    );
    const schema = z.object({ n: z.number() });
    await expect(apiRequest('/me', { schema })).resolves.toEqual({ n: 3 });
    raced = false;
    // Forget the first rotation, or a request sent in the same millisecond would skip refreshing.
    localStorage.clear();
    await expect(apiRequest('/me', { schema })).rejects.toMatchObject({ status: 401 });
  });
});
