import { ENDPOINTS, HealthResponseSchema, type HealthResponse } from '@doqto/shared';
import { apiRequest } from './client';

export function getHealth(): Promise<HealthResponse> {
  return apiRequest(ENDPOINTS.health, { schema: HealthResponseSchema, noRefresh: true });
}
