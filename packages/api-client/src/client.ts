import { ApiErrorSchema, ENDPOINTS } from '@doqto/shared';
import type { ZodType } from 'zod';
import { ApiError, ContractError } from './errors';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions<T> {
  method?: Method;
  /** JSON body. */
  body?: unknown;
  /** Multipart body (uploads); sent as is so the browser sets the boundary. */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  schema: ZodType<T>;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth endpoints themselves). */
  noRefresh?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientConfig {
  /**
   * Absolute (`http://localhost:4000/api/v1`) or same-origin (`/api/v1`, proxied by the Next
   * rewrite on the demo deployment).
   */
  apiUrl: string;
  /** localStorage key that the tab which last rotated the refresh cookie writes to. */
  refreshMarkKey?: string;
  /** Web Lock name shared by the tabs of one origin while a refresh runs. */
  refreshLockName?: string;
  /** Path that rotates the session cookie. Defaults to the patient `POST /auth/refresh`. */
  refreshPath?: string;
}

export interface ApiClient {
  buildUrl: (path: string, query?: RequestOptions<unknown>['query'], base?: string) => string;
  apiRequest: <T>(path: string, opts: RequestOptions<T>) => Promise<T>;
  /** Rotates the session now, e.g. after onboarding so the access token carries a new role. */
  refreshNow: () => Promise<boolean>;
}

async function toApiError(res: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  const parsed = ApiErrorSchema.safeParse(payload);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(res.status, code, message, details ?? {});
  }
  // Not the contract envelope (a proxy error page, a network middlebox): map the status.
  return new ApiError(
    res.status,
    res.status >= 500 ? 'INTERNAL' : `HTTP_${res.status}`,
    res.statusText || 'Request failed',
    {},
  );
}

/**
 * A refresh that raced another one (another device or a tab without Web Locks) gets
 * `REFRESH_INVALID` with `details.raced: true` and leaves the winner's cookies in place,
 * so the original request can simply be retried (CONTRACT.md, BE-04).
 */
async function lostRace(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const body: unknown = await res.json().catch(() => null);
  const error = (body as { error?: { code?: unknown; details?: { raced?: unknown } } } | null)
    ?.error;
  return error?.code === 'REFRESH_INVALID' && error.details?.raced === true;
}

/** One client per app: each keeps its own single-flight refresh state. */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const markKey = config.refreshMarkKey ?? 'doqto_refreshed_at';
  const lockName = config.refreshLockName ?? 'doqto-auth-refresh';
  const refreshPath = config.refreshPath ?? ENDPOINTS.auth.refresh;
  let refreshing: Promise<boolean> | null = null;

  function buildUrl(
    path: string,
    query?: RequestOptions<unknown>['query'],
    base = typeof window === 'undefined' ? undefined : window.location.origin,
  ): string {
    const url = new URL(config.apiUrl.replace(/\/$/, '') + path, base);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  function lastRefreshAt(): number {
    try {
      return Number(localStorage.getItem(markKey)) || 0;
    } catch {
      return 0;
    }
  }

  function markRefreshed() {
    try {
      localStorage.setItem(markKey, String(Date.now()));
    } catch {
      // Storage blocked: other tabs simply refresh on their own.
    }
  }

  /** Runs `fn` while holding a lock shared by every tab of this origin (Web Locks), when supported. */
  function acrossTabs<T>(fn: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    return locks ? locks.request(lockName, fn) : fn();
  }

  /**
   * Rotates the httpOnly refresh cookie. Single-flight: one request per tab, and tabs queue on a
   * Web Lock. A tab that waited skips its own refresh when another tab already rotated after its
   * request was sent, because a second rotation of the same token counts as reuse and the API
   * would revoke the whole session (BE-04 review).
   */
  function refreshSession(requestSentAt: number): Promise<boolean> {
    refreshing ??= acrossTabs(async () => {
      if (lastRefreshAt() >= requestSentAt) return true;
      const ok = await fetch(buildUrl(refreshPath), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // The browser sends an empty body; the API reads the httpOnly refresh cookie.
        body: '{}',
      })
        .then(async (res) => res.ok || (await lostRace(res)))
        .catch(() => false);
      if (ok) markRefreshed();
      return ok;
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function apiRequest<T>(path: string, opts: RequestOptions<T>): Promise<T> {
    const send = () =>
      fetch(buildUrl(path, opts.query), {
        method: opts.method ?? 'GET',
        // Auth rides on httpOnly cookies set by the API (TDD 9.2).
        credentials: 'include',
        headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: opts.formData ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        signal: opts.signal,
      });

    const sentAt = Date.now();
    let res = await send();
    if (res.status === 401 && !opts.noRefresh && (await refreshSession(sentAt))) {
      res = await send();
    }
    if (!res.ok) throw await toApiError(res);

    const data: unknown = res.status === 204 ? undefined : await res.json();
    const parsed = opts.schema.safeParse(data);
    if (!parsed.success) throw new ContractError(path, parsed.error.issues);
    return parsed.data;
  }

  return { buildUrl, apiRequest, refreshNow: () => refreshSession(Number.MAX_SAFE_INTEGER) };
}
