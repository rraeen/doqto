import { z } from 'zod';
import { ProviderModeSchema } from './enums';

/** `GET /health` */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  providerMode: ProviderModeSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
