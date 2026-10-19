import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'doqto:isPublic';

/**
 * Opt a route (or a whole controller) out of the global `JwtAuthGuard`; everything else needs
 * a valid access token. Importable by every module, including `integrations/**` (webhooks, demo
 * file serving). Every public route must be on the allowlist in `test/public-routes.e2e-spec.ts`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
