import { isApiError, isNetworkError } from '@doqto/api-client';
import {
  ApplicationDetailSchema,
  ApplicationListSchema,
  ProfileChangeDetailSchema,
  ProfileChangeListSchema,
  ENDPOINTS,
  type ApplicationDecisionRequest,
  type ApplicationDetail,
  type ApplicationList,
  type ProfileChangeDetail,
  type ProfileChangeList,
  type UnitStatus,
} from '@doqto/shared';
import { apiRequest } from './api';

const paths = ENDPOINTS.platform;

export const applicationsKey = (status: UnitStatus | 'all') =>
  ['admin', 'applications', status] as const;

export const listApplications = (status: UnitStatus | 'all'): Promise<ApplicationList> =>
  apiRequest(paths.applications, {
    query: status === 'all' ? undefined : { status },
    schema: ApplicationListSchema,
  });

export const getApplication = (id: string): Promise<ApplicationDetail> =>
  apiRequest(paths.application(id), { schema: ApplicationDetailSchema });

export const decideApplication = (
  id: string,
  input: ApplicationDecisionRequest,
): Promise<ApplicationDetail> =>
  apiRequest(paths.decision(id), { method: 'POST', body: input, schema: ApplicationDetailSchema });

export const profileChangesKey = ['admin', 'profile-changes'] as const;

/** Changes doctors made to their profile, waiting for approval. */
export const listProfileChanges = (): Promise<ProfileChangeList> =>
  apiRequest(paths.profileChanges, { schema: ProfileChangeListSchema });

export const getProfileChange = (id: string): Promise<ProfileChangeDetail> =>
  apiRequest(paths.profileChange(id), { schema: ProfileChangeDetailSchema });

export const decideProfileChange = (
  id: string,
  input: { decision: 'approve' | 'reject'; note?: string },
): Promise<ProfileChangeList> =>
  apiRequest(paths.profileChangeDecision(id), {
    method: 'POST',
    body: input,
    schema: ProfileChangeListSchema,
  });

/** The translation key (admin texts) for an error from the admin routes. */
export function authErrorKey(
  err: unknown,
): 'authError.forbidden' | 'authError.conflict' | 'authError.network' | 'authError.generic' {
  if (isNetworkError(err)) return 'authError.network';
  if (!isApiError(err)) return 'authError.generic';
  if (err.code === 'FORBIDDEN') return 'authError.forbidden';
  if (err.code === 'CONFLICT') return 'authError.conflict';
  return 'authError.generic';
}
