import {
  AdminDoctorDetailSchema,
  AdminDoctorQueueItemSchema,
  DoctorPrivateProfileSchema,
  ENDPOINTS,
  pageSchema,
  type AdminDoctorDetail,
  type AdminDoctorQueueItem,
  type DoctorPrivateProfile,
  type Page,
  type VerificationStatus,
  type VerifyDoctorRequest,
} from '@doqto/shared';
import { apiRequest } from './client';

const QueuePageSchema = pageSchema(AdminDoctorQueueItemSchema);

export function listDoctorQueue(
  status: VerificationStatus,
  cursor?: string,
  signal?: AbortSignal,
): Promise<Page<AdminDoctorQueueItem>> {
  return apiRequest(ENDPOINTS.admin.doctors, {
    query: { status, cursor },
    schema: QueuePageSchema,
    signal,
  });
}

export function getDoctorForReview(id: string, signal?: AbortSignal): Promise<AdminDoctorDetail> {
  return apiRequest(ENDPOINTS.admin.doctor(id), { schema: AdminDoctorDetailSchema, signal });
}

export function verifyDoctor(id: string, body: VerifyDoctorRequest): Promise<DoctorPrivateProfile> {
  return apiRequest(ENDPOINTS.admin.verifyDoctor(id), {
    method: 'POST',
    body,
    schema: DoctorPrivateProfileSchema,
  });
}
