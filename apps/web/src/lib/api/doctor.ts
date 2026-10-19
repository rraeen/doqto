import {
  DoctorPrivateProfileSchema,
  ENDPOINTS,
  RegistrationDocumentResponseSchema,
  type DoctorOnboardingRequest,
  type DoctorPrivateProfile,
  type RegistrationDocumentResponse,
  type UpdateDoctorProfileRequest,
} from '@doqto/shared';
import { apiRequest } from './client';
import { isApiError } from './errors';

function fileForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

/** The caller's doctor profile, or `null` when they have not onboarded. */
export async function getDoctorProfile(signal?: AbortSignal): Promise<DoctorPrivateProfile | null> {
  try {
    return await apiRequest(ENDPOINTS.doctor.profile, {
      schema: DoctorPrivateProfileSchema,
      signal,
    });
  } catch (err) {
    if (isApiError(err, 'NOT_FOUND')) return null;
    throw err;
  }
}

export function onboardDoctor(body: DoctorOnboardingRequest): Promise<DoctorPrivateProfile> {
  return apiRequest(ENDPOINTS.doctor.onboarding, {
    method: 'POST',
    body,
    schema: DoctorPrivateProfileSchema,
  });
}

export function updateDoctorProfile(
  body: UpdateDoctorProfileRequest,
): Promise<DoctorPrivateProfile> {
  return apiRequest(ENDPOINTS.doctor.profile, {
    method: 'PATCH',
    body,
    schema: DoctorPrivateProfileSchema,
  });
}

export function uploadRegistrationDocument(file: File): Promise<RegistrationDocumentResponse> {
  return apiRequest(ENDPOINTS.doctor.registrationDocument, {
    method: 'PUT',
    formData: fileForm(file),
    schema: RegistrationDocumentResponseSchema,
  });
}

export function uploadDoctorPhoto(file: File): Promise<DoctorPrivateProfile> {
  return apiRequest(ENDPOINTS.doctor.photo, {
    method: 'PUT',
    formData: fileForm(file),
    schema: DoctorPrivateProfileSchema,
  });
}
