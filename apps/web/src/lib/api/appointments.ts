import {
  PaymentResultSchema,
  CancelAppointmentResponseSchema,
  CreateAppointmentResponseSchema,
  ENDPOINTS,
  MyAppointmentSchema,
  RescheduleAppointmentResponseSchema,
  SlotsResponseSchema,
  pageSchema,
  type PaymentResult,
  type VerifyPaymentRequest,
  type CancelAppointmentResponse,
  type CancelReason,
  type CreateAppointmentRequest,
  type CreateAppointmentResponse,
  type MyAppointment,
  type ConfirmAppointmentResponse,
  ConfirmAppointmentResponseSchema,
  type RescheduleAppointmentResponse,
  type Page,
  type SlotsResponse,
} from '@doqto/shared';
import { apiRequest } from './client';

export function getSlots(
  doctorId: string,
  query: { clinicId: string; date: string },
  signal?: AbortSignal,
): Promise<SlotsResponse> {
  return apiRequest(ENDPOINTS.doctors.slots(doctorId), {
    query,
    schema: SlotsResponseSchema,
    signal,
  });
}

/** Holds the slot for 10 minutes and returns the order to pay. 409 `SLOT_TAKEN` if it was lost. */
export function createAppointment(
  body: CreateAppointmentRequest,
): Promise<CreateAppointmentResponse> {
  return apiRequest(ENDPOINTS.appointments.create, {
    method: 'POST',
    body,
    schema: CreateAppointmentResponseSchema,
  });
}

/** Demo mode only: the "Pay (demo)" button. Live mode pays through Razorpay Checkout. */
export function demoPay(appointmentId: string): Promise<PaymentResult> {
  return apiRequest(ENDPOINTS.payments.demoPay, {
    method: 'POST',
    body: { appointmentId },
    schema: PaymentResultSchema,
  });
}

/** Razorpay Checkout success: the API checks the signature, then the booking moves forward. */
export function verifyPayment(body: VerifyPaymentRequest): Promise<PaymentResult> {
  return apiRequest(ENDPOINTS.payments.verify, {
    method: 'POST',
    body,
    schema: PaymentResultSchema,
  });
}

export function listMyAppointments(
  query: { tab?: 'upcoming' | 'past'; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<MyAppointment>> {
  return apiRequest(ENDPOINTS.appointments.mine, {
    query: { ...query },
    schema: pageSchema(MyAppointmentSchema),
    signal,
  });
}

export function cancelAppointment(
  id: string,
  reason?: CancelReason,
): Promise<CancelAppointmentResponse> {
  return apiRequest(ENDPOINTS.appointments.cancel(id), {
    method: 'POST',
    body: reason ? { reason } : {},
    schema: CancelAppointmentResponseSchema,
  });
}

/** Moves a confirmed booking to another free slot; the fee and visit code carry over. */
export function rescheduleAppointment(
  id: string,
  slotStart: string,
): Promise<RescheduleAppointmentResponse> {
  return apiRequest(ENDPOINTS.appointments.reschedule(id), {
    method: 'POST',
    body: { slotStart },
    schema: RescheduleAppointmentResponseSchema,
  });
}

/**
 * The doctor accepts a paid booking, which creates the visit code. The real endpoint is for
 * clinic staff; the mock lets the patient trigger it so the step can be tried in a demo.
 */
export function confirmAppointmentAsDoctor(id: string): Promise<ConfirmAppointmentResponse> {
  return apiRequest(ENDPOINTS.clinic.confirmAppointment(id), {
    method: 'POST',
    body: {},
    schema: ConfirmAppointmentResponseSchema,
  });
}
