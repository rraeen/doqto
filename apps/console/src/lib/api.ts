import { createApiClient } from '@doqto/api-client';
import { env } from '@/lib/env';

// This app has its own session: separate refresh marker, tab lock and refresh route, so a
// patient session on the same machine is never touched. The route arrives with phase 2B.
export const { apiRequest, buildUrl, refreshNow } = createApiClient({
  apiUrl: env.apiUrl,
  refreshMarkKey: 'doqto_console_refreshed_at',
  refreshLockName: 'doqto-console-refresh',
  refreshPath: '/console/auth/refresh',
});
