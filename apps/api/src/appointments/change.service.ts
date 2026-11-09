import {
  CancelAppointmentRequestSchema,
  RescheduleAppointmentRequestSchema,
  canReschedule,
  refundForPatientCancel,
  type CancelAppointmentResponse,
  type RescheduleAppointmentResponse,
} from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { PaymentsService } from '../payments/payments.service';
import { DoctorStatusService } from '../status/doctor-status.service';
import { toAppointment } from './appointment.mappers';
import { Appointment, AppointmentDocument } from './appointment.schema';
import { BookingService, conflict, historyEntry } from './booking.service';
import { SlotsService } from './slots.service';

const isDuplicateKey = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;
const CANCELLABLE = ['pending_payment', 'pending_confirmation', 'confirmed'];

/**
 * BE-28/29: the patient cancels a booking (with the refund the rules allow) or moves it. Moving a
 * confirmed booking sends it back to the doctor to confirm again, so a visit never changes time
 * without the doctor knowing.
 */
@Injectable()
export class ChangeService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    private readonly booking: BookingService,
    private readonly slots: SlotsService,
    private readonly payments: PaymentsService,
    private readonly status: DoctorStatusService,
  ) {}

  async cancel(
    userId: string,
    id: string,
    raw: unknown,
    now = new Date(),
  ): Promise<CancelAppointmentResponse> {
    const body = zodCheck(CancelAppointmentRequestSchema, raw);
    const a = await this.booking.loadOwn(userId, id);
    if (!CANCELLABLE.includes(a.status)) {
      throw conflict('This appointment can no longer be cancelled');
    }

    const live = await this.status.find(a.doctorId, a.date);
    const refund = refundForPatientCancel({
      status: a.status,
      slotStart: a.slotStart?.toISOString() ?? null,
      bookingFee: a.bookingFee,
      now: now.getTime(),
      doctorLateMinutes: live?.state === 'running_late' ? (live.delayMinutes ?? 0) : 0,
    });

    // One atomic step on the status we just read: two taps, or a doctor confirming at the same
    // moment, can never cancel twice or refund twice.
    const updated = await this.appointments
      .findOneAndUpdate(
        { _id: a._id, status: a.status },
        {
          $set: {
            status: 'cancelled_by_patient',
            cancelledAt: now,
            ...(body.reason ? { cancelReason: body.reason } : {}),
          },
          $unset: { holdExpiresAt: 1, visitCode: 1, visitCodeSealed: 1 },
          ...historyEntry('cancelled_by_patient', now, userId, body.reason),
        },
        { new: true },
      )
      .exec();
    if (!updated) throw conflict('This appointment just changed. Refresh and try again.');

    let refunded = 0;
    if (refund.kind === 'full') {
      // A gateway hiccup must not undo the cancellation: the refund is retried by the job.
      const result = await this.payments.refundPayment(updated, 'patient_cancel').catch(() => null);
      refunded = result?.amount ?? 0;
    }
    return {
      appointment: toAppointment(updated),
      refund: { kind: refund.kind, amount: refund.kind === 'full' ? refunded || refund.amount : 0 },
    };
  }

  async reschedule(
    userId: string,
    id: string,
    raw: unknown,
    now = new Date(),
  ): Promise<RescheduleAppointmentResponse> {
    const body = zodCheck(RescheduleAppointmentRequestSchema, raw);
    const a = await this.booking.loadOwn(userId, id);
    if (
      !canReschedule({
        status: a.status,
        slotStart: a.slotStart?.toISOString() ?? null,
        now: now.getTime(),
      })
    ) {
      throw conflict('This appointment can no longer be moved');
    }
    if (a.slotStart?.toISOString() === new Date(body.slotStart).toISOString()) {
      throw conflict('That is already your time');
    }
    const slot = await this.slots.resolveOnlineSlot(a.doctorId, a.clinicId, body.slotStart, now);

    // A confirmation was for the old time, so the doctor has to accept the new one: the booking
    // goes back to waiting for them (the fee already paid stays), and the old visit code is dropped.
    // A new code is made when the doctor confirms. A booking already waiting just stays waiting.
    const wasConfirmed = a.status === 'confirmed';
    const next = wasConfirmed ? 'pending_confirmation' : a.status;
    let updated: AppointmentDocument | null;
    try {
      updated = await this.appointments
        .findOneAndUpdate(
          { _id: a._id, status: a.status, slotStart: a.slotStart },
          {
            $set: {
              slotStart: slot.start,
              slotEnd: slot.end,
              date: slot.date,
              status: next,
            },
            ...(wasConfirmed ? { $unset: { visitCode: 1, visitCodeSealed: 1 } } : {}),
            $inc: { rescheduleCount: 1 },
            ...historyEntry(next, now, userId, 'rescheduled'),
          },
          { new: true },
        )
        .exec();
    } catch (e) {
      // The unique { doctorId, slotStart } index: someone took the new slot first.
      if (isDuplicateKey(e)) {
        throw new AppException(409, 'SLOT_TAKEN', 'That slot was just booked. Pick another.');
      }
      throw e;
    }
    if (!updated) throw conflict('This appointment just changed. Refresh and try again.');
    return { appointment: toAppointment(updated) };
  }

}
