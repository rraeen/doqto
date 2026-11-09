import {
  AppointmentStatusSchema,
  ConfirmAppointmentResponseSchema,
  PaymentResultSchema,
  CancelAppointmentRequestSchema,
  CancelAppointmentResponseSchema,
  CreateAppointmentRequestSchema,
  CreateAppointmentResponseSchema,
  DemoPayRequestSchema,
  ENDPOINTS,
  MyAppointmentSchema,
  MyAppointmentsQuerySchema,
  RescheduleAppointmentRequestSchema,
  RescheduleAppointmentResponseSchema,
  SlotsQuerySchema,
  SlotsResponseSchema,
  canReschedule,
  pageSchema,
  refundForPatientCancel,
  type Appointment,
  type MyAppointment,
} from '@doqto/shared';
import { delay, http } from 'msw';
import * as db from './db';
import { apiError, ok, parseBody, unauthenticated, url } from './respond';
import { computeSlots, holdExpiry, isBookableDate } from './slots';

const DEFAULT_BOOKING_FEE = 1500;
const UPCOMING = new Set([
  'pending_payment',
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_consult',
]);
/** The visit code is shown to the patient from the doctor's confirmation until the visit closes. */
const SHOWS_CODE = new Set(['confirmed', 'checked_in', 'in_consult']);

/** What the API returns for an appointment: everything but the user and the visit code. */
function publicAppointment(a: db.MockAppointment): Appointment {
  const { userId: _u, patientPhone: _p, bookingFee: _f, visitCode: _c, ...appointment } = a;
  return appointment;
}

function joined(a: db.MockAppointment): MyAppointment | null {
  const doctor = db.doctorById(a.doctorId);
  const clinic = db.clinicById(a.clinicId);
  if (!doctor || !clinic) return null;
  return {
    ...publicAppointment(a),
    doctor: {
      id: doctor.id,
      name: doctor.name,
      slug: doctor.slug,
      specialties: doctor.specialties,
    },
    clinic: { id: clinic.id, name: clinic.name, area: clinic.address.area ?? null },
    bookingFee: a.bookingFee,
    visitCode: SHOWS_CODE.has(a.status) ? a.visitCode : null,
  };
}

function ownAppointment(id: string, userId: string) {
  const appt = db.appointmentById(id);
  return appt && appt.userId === userId ? appt : null;
}

export const handlersBooking = [
  http.post(url('/appointments/:id/reschedule'), async ({ request, params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, RescheduleAppointmentRequestSchema);
    if (body.error) return body.error;
    const appt = ownAppointment(String(params.id), user.id);
    if (!appt) return apiError(404, 'NOT_FOUND', 'Appointment not found');
    await delay(400);
    const now = Date.now();
    db.expireHolds(now);
    if (!canReschedule({ status: appt.status, slotStart: appt.slotStart, now })) {
      return apiError(409, 'CONFLICT', 'This appointment can no longer be moved');
    }
    const startIso = new Date(body.data.slotStart).toISOString();
    const date = new Date(Date.parse(startIso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
    // The booking's own slot is about to be released, so it must not block itself.
    const held = db.heldSlotStarts(appt.doctorId, appt.clinicId);
    if (appt.slotStart) held.delete(appt.slotStart);
    const slot = computeSlots(date, now, held).find((s) => s.start === startIso);
    if (!slot) return apiError(409, 'SLOT_TAKEN', 'That slot is no longer available');
    const moved: db.MockAppointment = {
      ...appt,
      date,
      slotStart: slot.start,
      slotEnd: slot.end,
    };
    db.putAppointment(moved);
    return ok(RescheduleAppointmentResponseSchema, { appointment: publicAppointment(moved) });
  }),

  http.get(url('/doctors/:id/slots'), async ({ request, params }) => {
    const query = SlotsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      return apiError(400, 'VALIDATION_FAILED', 'Validation failed', {
        issues: query.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const doctor = db.doctorById(String(params.id));
    const clinic = db.clinicById(query.data.clinicId);
    if (!doctor || !clinic || !clinic.doctorIds.includes(doctor.id)) {
      return apiError(404, 'NOT_FOUND', 'Doctor or clinic not found');
    }
    await delay(250);
    const now = Date.now();
    db.expireHolds(now);
    const { date } = query.data;
    return ok(SlotsResponseSchema, {
      date,
      clinicId: clinic.id,
      scheduled: isBookableDate(date, now),
      slots: computeSlots(date, now, db.heldSlotStarts(doctor.id, clinic.id)),
      bookingFee: doctor.bookingFee ?? DEFAULT_BOOKING_FEE,
    });
  }),

  http.post(url(ENDPOINTS.appointments.create), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, CreateAppointmentRequestSchema);
    if (body.error) return body.error;
    const { doctorId, clinicId, slotStart, patientName, patientPhone, reason } = body.data;
    const doctor = db.doctorById(doctorId);
    const clinic = db.clinicById(clinicId);
    if (!doctor || !clinic || !clinic.doctorIds.includes(doctor.id)) {
      return apiError(404, 'NOT_FOUND', 'Doctor or clinic not found');
    }
    await delay(400);
    const now = Date.now();
    db.expireHolds(now);
    const startIso = new Date(slotStart).toISOString();
    const date = new Date(Date.parse(startIso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
    const free = computeSlots(date, now, db.heldSlotStarts(doctor.id, clinic.id));
    const slot = free.find((s) => s.start === startIso);
    if (!slot) return apiError(409, 'SLOT_TAKEN', 'That slot is no longer available');

    const fee = doctor.bookingFee ?? DEFAULT_BOOKING_FEE;
    const appt: db.MockAppointment = {
      id: db.objectIdForMocks(),
      doctorId,
      clinicId,
      patientName,
      date,
      slotStart: slot.start,
      slotEnd: slot.end,
      source: 'online',
      status: 'pending_payment',
      holdExpiresAt: holdExpiry(now),
      queueToken: null,
      checkInAt: null,
      visitVerified: false,
      reviewUnlockAt: null,
      createdAt: new Date(now).toISOString(),
      userId: user.id,
      patientPhone,
      bookingFee: fee,
      visitCode: null,
    };
    void reason;
    db.putAppointment(appt);
    return ok(
      CreateAppointmentResponseSchema,
      {
        appointment: publicAppointment(appt),
        order: {
          provider: 'demo',
          orderId: `order_${appt.id}`,
          amount: fee,
          currency: 'INR',
          keyId: null,
        },
      },
      201,
    );
  }),

  http.post(url(ENDPOINTS.payments.demoPay), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, DemoPayRequestSchema);
    if (body.error) return body.error;
    await delay(600);
    db.expireHolds();
    const appt = ownAppointment(body.data.appointmentId, user.id);
    if (!appt) return apiError(404, 'NOT_FOUND', 'Appointment not found');
    if (appt.status === 'expired') {
      return apiError(409, 'CONFLICT', 'The hold on this slot ran out. Please book again.');
    }
    if (appt.status !== 'pending_payment') {
      return apiError(409, 'CONFLICT', 'This booking is already paid or closed');
    }
    // Paid: the slot stays held, and the booking now waits for the doctor to accept it.
    const paid: db.MockAppointment = {
      ...appt,
      status: 'pending_confirmation',
      holdExpiresAt: null,
    };
    db.putAppointment(paid);
    return ok(PaymentResultSchema, { appointment: publicAppointment(paid) });
  }),

  // The real endpoint is for the doctor and clinic staff. The mock lets the signed-in patient
  // call it, so the "doctor confirms" step can be tried without a doctor's console.
  http.post(url('/clinic/appointments/:id/confirm'), async ({ params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const appt = ownAppointment(String(params.id), user.id);
    if (!appt) return apiError(404, 'NOT_FOUND', 'Appointment not found');
    await delay(500);
    if (appt.status !== 'pending_confirmation') {
      return apiError(409, 'CONFLICT', 'This booking is not waiting for confirmation');
    }
    const confirmed: db.MockAppointment = {
      ...appt,
      status: 'confirmed',
      visitCode: String(1000 + Math.floor(Math.random() * 9000)),
    };
    db.putAppointment(confirmed);
    return ok(ConfirmAppointmentResponseSchema, { appointment: publicAppointment(confirmed) });
  }),

  http.get(url(ENDPOINTS.appointments.mine), async ({ request }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const query = MyAppointmentsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return apiError(400, 'VALIDATION_FAILED', 'Validation failed', {
        issues: query.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    await delay(250);
    db.expireHolds();
    db.ensurePastVisits(user.id);
    const rows = db
      .appointmentsOfUser(user.id)
      .map(joined)
      .filter((a): a is MyAppointment => a !== null)
      .filter((a) => {
        if (!query.data.tab) return true;
        return UPCOMING.has(a.status) === (query.data.tab === 'upcoming');
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return ok(pageSchema(MyAppointmentSchema), { items: rows, nextCursor: null });
  }),

  http.post(url('/appointments/:id/cancel'), async ({ request, params }) => {
    const user = db.sessionUser();
    if (!user) return unauthenticated();
    const body = await parseBody(request, CancelAppointmentRequestSchema);
    if (body.error) return body.error;
    const appt = ownAppointment(String(params.id), user.id);
    if (!appt) return apiError(404, 'NOT_FOUND', 'Appointment not found');
    await delay(400);
    const status = AppointmentStatusSchema.parse(appt.status);
    if (!['pending_payment', 'pending_confirmation', 'confirmed'].includes(status)) {
      return apiError(409, 'CONFLICT', 'This appointment can no longer be cancelled');
    }
    const refund = refundForPatientCancel({
      status,
      slotStart: appt.slotStart,
      bookingFee: appt.bookingFee,
      now: Date.now(),
    });
    const cancelled: db.MockAppointment = {
      ...appt,
      status: 'cancelled_by_patient',
      holdExpiresAt: null,
    };
    db.putAppointment(cancelled);
    return ok(CancelAppointmentResponseSchema, {
      appointment: publicAppointment(cancelled),
      refund,
    });
  }),
];
