# @doqto/api-client

The typed fetch client for the Doqto API, shared by `apps/web` and `apps/console`.

```ts
const { apiRequest, buildUrl, refreshNow } = createApiClient({
  apiUrl: env.apiUrl,
  refreshMarkKey: 'doqto_console_refreshed_at', // per app, so sessions never share state
  refreshLockName: 'doqto-console-refresh',
  refreshPath: '/console/auth/refresh',
});

const me = await apiRequest('/me', { schema: MeResponseSchema });
```

- Cookie sessions: requests send `credentials: 'include'`. On a 401 the client rotates the refresh cookie once (single flight, shared by every tab through a Web Lock) and retries.
- Every response is checked against a Zod schema from `@doqto/shared`; a mismatch throws `ContractError`, an API error envelope becomes `ApiError`.
- Each app creates its own client, with its own refresh marker, lock and refresh path.

```
pnpm --filter @doqto/api-client test
```
