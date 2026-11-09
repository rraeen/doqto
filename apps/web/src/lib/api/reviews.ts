import {
  DoctorReviewsPageSchema,
  ENDPOINTS,
  MyReviewResponseSchema,
  ReviewEligibilityResponseSchema,
  type CreateReviewRequest,
  type DoctorReviewsPage,
  type MyReview,
  type ReportReason,
  type ReviewEligibility,
  type UpdateReviewRequest,
} from '@doqto/shared';
import { z } from 'zod';
import { apiRequest } from './client';
import { isApiError } from './errors';

const NoContent = z.undefined();

/** The patient's finished visits and whether each can be reviewed now. */
export async function getReviewEligibility(signal?: AbortSignal): Promise<ReviewEligibility[]> {
  const res = await apiRequest(ENDPOINTS.reviews.eligibility, {
    schema: ReviewEligibilityResponseSchema,
    signal,
  });
  return res.items;
}

export async function createReview(body: CreateReviewRequest): Promise<MyReview> {
  const res = await apiRequest(ENDPOINTS.reviews.create, {
    method: 'POST',
    body,
    schema: MyReviewResponseSchema,
  });
  return res.review;
}

/** One edit, within 7 days of submitting. */
export async function updateReview(id: string, body: UpdateReviewRequest): Promise<MyReview> {
  const res = await apiRequest(ENDPOINTS.reviews.byId(id), {
    method: 'PATCH',
    body,
    schema: MyReviewResponseSchema,
  });
  return res.review;
}

/** The patient's own review of a visit, or `null` when they have not written one. */
export async function getMyReview(
  appointmentId: string,
  signal?: AbortSignal,
): Promise<MyReview | null> {
  try {
    const res = await apiRequest(ENDPOINTS.reviews.mine(appointmentId), {
      schema: MyReviewResponseSchema,
      signal,
    });
    return res.review;
  } catch (err) {
    if (isApiError(err, 'NOT_FOUND')) return null;
    throw err;
  }
}

export function getDoctorReviews(
  doctorId: string,
  query: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<DoctorReviewsPage> {
  return apiRequest(ENDPOINTS.doctors.reviews(doctorId), {
    query: { ...query },
    schema: DoctorReviewsPageSchema,
    signal,
  });
}

export function reportReview(id: string, reason: ReportReason): Promise<void> {
  return apiRequest(ENDPOINTS.reviews.report(id), {
    method: 'POST',
    body: { reason },
    schema: NoContent,
  });
}
