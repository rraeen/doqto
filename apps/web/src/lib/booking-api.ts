'use client';

import type { CancelReason, CreateAppointmentRequest, VerifyPaymentRequest } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from './api/lazy';
import { env } from './env';

export const myAppointmentsKey = ['my-appointments'] as const;
const slotsKey = (doctorId: string, clinicId: string, date: string) =>
  ['slots', doctorId, clinicId, date] as const;

/** Free slots for one doctor, clinic and day. Short stale time: other patients book too. */
export function useSlots(input: { doctorId?: string; clinicId?: string; date?: string | null }) {
  const { doctorId, clinicId, date } = input;
  return useQuery({
    queryKey: slotsKey(doctorId ?? '', clinicId ?? '', date ?? ''),
    queryFn: ({ signal }) =>
      appointmentsApi.getSlots(
        doctorId as string,
        { clinicId: clinicId as string, date: date as string },
        signal,
      ),
    enabled: env.bookingApi && Boolean(doctorId && clinicId && date),
    staleTime: 15_000,
  });
}

/** Holds a slot for 10 minutes. On `SLOT_TAKEN` the screen refreshes its slots. */
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAppointmentRequest) => appointmentsApi.createAppointment(body),
    onError: () => void qc.invalidateQueries({ queryKey: ['slots'] }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: myAppointmentsKey }),
  });
}

/** Demo mode payment: confirms the held booking and returns the visit code once. */
export function useDemoPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => appointmentsApi.demoPay(appointmentId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: myAppointmentsKey });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

/** Razorpay Checkout result: the API verifies the signature and confirms the payment. */
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VerifyPaymentRequest) => appointmentsApi.verifyPayment(body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: myAppointmentsKey });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason?: CancelReason }) =>
      appointmentsApi.cancelAppointment(input.id, input.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: myAppointmentsKey });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; slotStart: string }) =>
      appointmentsApi.rescheduleAppointment(input.id, input.slotStart),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: myAppointmentsKey });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

