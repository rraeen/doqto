import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError, ContractError } from './errors';
import { z } from 'zod';

const schema = z.object({ ok: z.literal(true) });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('createApiClient', () => {
  it('builds URLs from an absolute or same-origin base, dropping undefined query values', () => {
    const abs = createApiClient({ apiUrl: 'http://localhost:4000/api/v1/' });
    expect(abs.buildUrl('/me', { limit: 20, skip: undefined })).toBe(
      'http://localhost:4000/api/v1/me?limit=20',
    );
    const rel = createApiClient({ apiUrl: '/api/v1' });
    expect(rel.buildUrl('/me', undefined, 'https://console.doqto.in')).toBe(
      'https://console.doqto.in/api/v1/me',
    );
  });

  it('returns validated data and sends cookies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: true }));
    const api = createApiClient({ apiUrl: 'http://localhost:4000/api/v1' });
    await expect(api.apiRequest('/ping', { schema })).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('turns the contract error envelope into an ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(409, { error: { code: 'SLOT_TAKEN', message: 'Taken', details: {}, requestId: 'r1' } }),
    );
    const api = createApiClient({ apiUrl: 'http://localhost:4000/api/v1' });
    const err = await api.apiRequest('/x', { schema }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
  });

  it('rejects a response that does not match the contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { nope: 1 }));
    const api = createApiClient({ apiUrl: 'http://localhost:4000/api/v1' });
    await expect(api.apiRequest('/x', { schema })).rejects.toBeInstanceOf(ContractError);
  });

  it('refreshes once on 401, then retries the request', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHENTICATED', message: 'x', requestId: 'r' } }),
      )
      .mockResolvedValueOnce(json(200, { ok: true })) // the refresh call
      .mockResolvedValueOnce(json(200, { ok: true })); // the retried request
    const api = createApiClient({
      apiUrl: 'http://localhost:4000/api/v1',
      refreshPath: '/console/auth/refresh',
    });
    await expect(api.apiRequest('/x', { schema })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/console/auth/refresh');
  });
});
