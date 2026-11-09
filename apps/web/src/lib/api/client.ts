import { createApiClient, type RequestOptions } from '@doqto/api-client';
import { env } from '@/lib/env';

export type { RequestOptions };

/** Set in localStorage by whichever tab last rotated the refresh cookie. */
export const REFRESH_MARK_KEY = 'doqto_refreshed_at';

// The client itself lives in `@doqto/api-client`, shared with the console.
const client = createApiClient({ apiUrl: env.apiUrl, refreshMarkKey: REFRESH_MARK_KEY });

export const { buildUrl, apiRequest, refreshNow } = client;
