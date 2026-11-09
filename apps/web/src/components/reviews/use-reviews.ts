'use client';

import {
  REVIEW_EDIT_DAYS,
  canEditReview,
  reviewWindow,
  reviewWindowState,
  reviewerDisplayName,
  type MyReview,
  type PublicReview,
  type ReportReason,
  type ReviewEligibility,
  type UpdateReviewRequest,
} from '@doqto/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { reviewsApi } from '@/lib/api/lazy';
import { looksRisky, saveDemoReview, toPublicReview, useDemoReviews } from '@/lib/demo-reviews';
import { env } from '@/lib/env';
import { sampleReviews, SAMPLE_REVIEWED_SLUG } from '@/lib/sample-reviews';
import { useMe } from '@/lib/session';
import { useNow } from '@/lib/use-now';

/** In demo mode a visit lasts this long, so its review window can be worked out. */
const DEMO_VISIT_MINUTES = 15;

const eligibilityKey = ['review-eligibility'] as const;
const myReviewKey = (appointmentId: string) => ['my-review', appointmentId] as const;
const doctorReviewsKey = (doctorId: string) => ['doctor-reviews', doctorId] as const;

/** The patient's finished visits and whether each can be reviewed (API, or demo examples). */
export function useReviewEligibility() {
  const me = useMe();
  const { all } = useAppointments();
  const demo = useDemoReviews(!env.bookingApi);
  const now = useNow();
  const api = useQuery({
    queryKey: eligibilityKey,
    queryFn: ({ signal }) => reviewsApi.getReviewEligibility(signal),
    enabled: env.bookingApi && Boolean(me.data),
  });

  const demoItems = useMemo((): ReviewEligibility[] => {
    if (env.bookingApi || now === 0) return [];
    return all
      .filter((a) => a.status === 'completed' && a.start)
      .map((a) => {
        const ended = new Date(
          Date.parse(a.start as string) + DEMO_VISIT_MINUTES * 60_000,
        ).toISOString();
        const w = reviewWindow(ended);
        const existing = demo[a.id];
        return {
          appointmentId: a.id,
          doctor: { id: a.doctor.slug, name: a.doctor.name, slug: a.doctor.slug },
          clinicName: a.clinic.name,
          visitEndedAt: ended,
          state: existing ? 'reviewed' : reviewWindowState(ended, now),
          unlocksAt: w.unlocksAt,
          closesAt: w.closesAt,
          reviewId: existing?.review.id ?? null,
        } satisfies ReviewEligibility;
      })
      .sort((x, y) => Date.parse(y.visitEndedAt) - Date.parse(x.visitEndedAt));
  }, [all, demo, now]);

  return {
    me,
    items: env.bookingApi ? (api.data ?? []) : demoItems,
    isPending: me.isPending || (env.bookingApi ? Boolean(me.data) && api.isPending : now === 0),
  };
}

/** The patient's own review of one visit, or `null`. */
export function useMyReview(appointmentId: string) {
  const me = useMe();
  const demo = useDemoReviews(!env.bookingApi);
  const api = useQuery({
    queryKey: myReviewKey(appointmentId),
    queryFn: ({ signal }) => reviewsApi.getMyReview(appointmentId, signal),
    enabled: env.bookingApi && Boolean(me.data),
  });
  if (!env.bookingApi) return { review: demo[appointmentId]?.review ?? null, isPending: false };
  return { review: api.data ?? null, isPending: Boolean(me.data) && api.isPending };
}

interface SubmitInput {
  visit: ReviewEligibility;
  /** The existing review when editing. */
  existing: MyReview | null;
  body: UpdateReviewRequest;
  reviewerName: string | null | undefined;
}

/** Sends a new review, or the one allowed edit. */
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visit, existing, body, reviewerName }: SubmitInput): Promise<MyReview> => {
      if (env.bookingApi) {
        return existing
          ? reviewsApi.updateReview(existing.id, body)
          : reviewsApi.createReview({ appointmentId: visit.appointmentId, ...body });
      }
      const nowIso = new Date().toISOString();
      const review: MyReview = {
        id: existing?.id ?? `demo-review-${Date.now()}`,
        appointmentId: visit.appointmentId,
        doctorId: visit.doctor.id,
        ratings: body.ratings,
        wouldRecommend: body.wouldRecommend,
        reason: body.reason,
        text: body.text ?? null,
        waitedMinutes: body.waitedMinutes ?? null,
        state: looksRisky(body.text) ? 'held_for_review' : 'published',
        submittedAt: existing?.submittedAt ?? nowIso,
        editedAt: existing ? nowIso : null,
        canEditUntil: existing
          ? null
          : new Date(Date.now() + REVIEW_EDIT_DAYS * 86_400_000).toISOString(),
      };
      saveDemoReview(visit.appointmentId, {
        review,
        doctorSlug: visit.doctor.slug,
        reviewerName: reviewerDisplayName(reviewerName),
        visitMonth: visit.visitEndedAt.slice(0, 7),
      });
      return review;
    },
    onSuccess: (_review, { visit }) => {
      void qc.invalidateQueries({ queryKey: eligibilityKey });
      void qc.invalidateQueries({ queryKey: myReviewKey(visit.appointmentId) });
      void qc.invalidateQueries({ queryKey: ['doctor-reviews'] });
    },
  });
}

/** Whether a review can still be edited (once, within 7 days). */
export function reviewEditable(review: MyReview | null, now: number): boolean {
  if (!review || now === 0) return false;
  return canEditReview({ submittedAt: review.submittedAt, editedAt: review.editedAt, now });
}

/** Published reviews of a doctor, newest first, loaded a page at a time. */
export function useDoctorReviews(doctor: { id: string; slug: string }) {
  const demo = useDemoReviews(!env.bookingApi);
  const now = useNow();
  const api = useInfiniteQuery({
    queryKey: doctorReviewsKey(doctor.id),
    queryFn: ({ pageParam, signal }) =>
      reviewsApi.getDoctorReviews(doctor.id, { cursor: pageParam, limit: 10 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: env.bookingApi,
  });

  const demoItems = useMemo((): PublicReview[] => {
    if (env.bookingApi || now === 0) return [];
    const mine = Object.values(demo)
      .filter((d) => d.doctorSlug === doctor.slug && d.review.state === 'published')
      .map(toPublicReview);
    const examples = doctor.slug === SAMPLE_REVIEWED_SLUG ? sampleReviews(now) : [];
    return [...mine, ...examples].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
  }, [demo, doctor.slug, now]);

  if (!env.bookingApi) {
    return {
      items: demoItems,
      isPending: now === 0,
      isError: false,
      hasMore: false,
      loadMore: () => undefined,
      loadingMore: false,
    };
  }
  return {
    items: api.data?.pages.flatMap((p) => p.items) ?? [],
    isPending: api.isPending,
    isError: api.isError,
    hasMore: Boolean(api.hasNextPage),
    loadMore: () => void api.fetchNextPage(),
    loadingMore: api.isFetchingNextPage,
  };
}

/** Reports a review to the admins. In demo mode there is nobody to tell, so it just succeeds. */
export function useReportReview() {
  return useMutation({
    mutationFn: async (input: { id: string; reason: ReportReason }) => {
      if (env.bookingApi) await reviewsApi.reportReview(input.id, input.reason);
    },
  });
}
