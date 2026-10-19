import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, STATUS_HISTORY_MAX } from '../appointments/appointment.schema';
import { RefundRequests } from '../appointments/refund-requests.service';
import { AppConfig } from '../config/app-config.service';
import { Doctor, DoctorDocument } from '../doctors/doctor.schema';
import { dateParam, doctorNameParam, rupeesParam } from '../notifications/message-format';
import { NotificationsService } from '../notifications/notifications.service';
import { DoctorStatusEntity } from '../status/doctor-status.schema';

/** TDD 6.4 thresholds. */
export const LATE_ALERT_MINUTES = 20;
export const DELAY_GROWTH_ALERT_MINUTES = 15;
export const TURN_NEAR_TOKENS = 3;

type Oid = Types.ObjectId;

export interface AlertSummary {
  alerted: number;
  cancelled: number;
}

/**
 * BE-22 status alert rules (TDD 6.4), run in the request that changed the status or the queue.
 * Each message has a dedupe key, so a second tap never sends twice.
 */
@Injectable()
export class StatusAlertsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(DoctorStatusEntity.name) private readonly statuses: Model<DoctorStatusEntity>,
    private readonly notifications: NotificationsService,
    private readonly refunds: RefundRequests,
    private readonly config: AppConfig,
  ) {}

  private link(d: DoctorDocument, live: boolean): string {
    return `${this.config.get('WEB_PUBLIC_URL')}/d/${d.slug}${live ? '/live' : ''}`;
  }

  /** After `PUT /clinic/status`. */
  async afterStatusChange(
    doctorId: Oid,
    clinicId: Oid,
    date: string,
    now = new Date(),
  ): Promise<AlertSummary> {
    const st = await this.statuses.findOne({ doctorId, date }).exec();
    const doctor = await this.doctors
      .findById(doctorId, { name: 1, slug: 1, bookingFee: 1 })
      .exec();
    if (!st || !doctor) return { alerted: 0, cancelled: 0 };
    if (st.state === 'running_late' && st.delayMinutes >= LATE_ALERT_MINUTES) {
      return {
        alerted: await this.lateAlerts(st._id, doctor, clinicId, date, st.delayMinutes),
        cancelled: 0,
      };
    }
    if (st.state === 'on_leave' || st.state === 'done_for_day') {
      return this.cancelRemaining(doctor, clinicId, date, st.state, now);
    }
    return { alerted: 0, cancelled: 0 };
  }

  /** First alert at 20+ minutes late, again each time the delay grows by 15+ more. */
  private async lateAlerts(
    statusId: Oid,
    doctor: DoctorDocument,
    clinicId: Oid,
    date: string,
    delay: number,
  ) {
    // Claims this alert level atomically, so parallel taps alert once.
    const claimed = await this.statuses
      .findOneAndUpdate(
        {
          _id: statusId,
          $or: [
            { alertedDelayMinutes: { $exists: false } },
            { alertedDelayMinutes: { $lte: delay - DELAY_GROWTH_ALERT_MINUTES } },
          ],
        },
        { $set: { alertedDelayMinutes: delay } },
      )
      .exec();
    if (!claimed) return 0;
    // Booked patients who have not arrived; walk-ins are already at the clinic.
    const waiting = await this.appointments
      .find(
        { doctorId: doctor._id, clinicId, date, status: 'confirmed', source: { $ne: 'walk_in' } },
        { patientUserId: 1 },
      )
      .exec();
    let n = 0;
    for (const a of waiting) {
      const r = await this.notifications.notify({
        userId: a.patientUserId,
        template: 'doctor_running_late',
        params: () => [doctorNameParam(doctor.name), String(delay), this.link(doctor, true)],
        dedupeKey: `delay:${a._id.toHexString()}:${delay}`,
        appointmentId: a._id,
        alert: true,
      });
      if (r?.created) n++;
    }
    return n;
  }

  /**
   * On leave, or done for the day with bookings left: cancel what is left, owe the fee back and
   * send a rebook link. "Left" for done-for-day means slots still to come; earlier ones become
   * no-shows at end of day.
   */
  private async cancelRemaining(
    doctor: DoctorDocument,
    clinicId: Oid,
    date: string,
    state: 'on_leave' | 'done_for_day',
    now: Date,
  ): Promise<AlertSummary> {
    const filter = {
      doctorId: doctor._id,
      clinicId,
      date,
      status: 'confirmed' as const,
      ...(state === 'done_for_day' ? { slotStart: { $gt: now } } : {}),
    };
    const left = await this.appointments.find(filter, { _id: 1 }).exec();
    const reason = state === 'on_leave' ? 'Doctor on leave' : 'Doctor done for the day';
    let cancelled = 0;
    let alerted = 0;
    for (const { _id } of left) {
      const a = await this.appointments
        .findOneAndUpdate(
          { _id, status: 'confirmed' },
          {
            $set: { status: 'cancelled_by_clinic', cancelReason: reason },
            $push: {
              statusHistory: {
                $each: [{ status: 'cancelled_by_clinic', at: now, note: reason }],
                $slice: -STATUS_HISTORY_MAX,
              },
            },
          },
          { new: true },
        )
        .exec();
      if (!a) continue;
      cancelled++;
      // Only online bookings paid a fee; the front desk tells phone and walk-in patients.
      if (a.source !== 'online') continue;
      await this.refunds.clinicCancelled(a._id);
      const r = await this.notifications.notify({
        userId: a.patientUserId,
        template: 'appointment_cancelled_by_clinic',
        params: (lang) => [
          doctorNameParam(doctor.name),
          dateParam(date, lang),
          rupeesParam(doctor.bookingFee ?? 0),
          this.link(doctor, false),
        ],
        dedupeKey: `cancel:${a._id.toHexString()}`,
        appointmentId: a._id,
      });
      if (r?.created) alerted++;
    }
    return { alerted, cancelled };
  }

  /** After the queue moves (`next`, `move`): the patient now 3 tokens away hears about it once. */
  async afterQueueChange(doctorId: Oid, clinicId: Oid, date: string): Promise<number> {
    const scope = { doctorId, clinicId, date };
    const inConsult = await this.appointments
      .countDocuments({ ...scope, status: 'in_consult' })
      .exec();
    const index = TURN_NEAR_TOKENS - inConsult;
    if (index < 0) return 0;
    const [target] = await this.appointments
      .find({ ...scope, status: 'checked_in' }, { patientUserId: 1 })
      .sort({ effectiveTime: 1, queueToken: 1 })
      .skip(index)
      .limit(1)
      .exec();
    if (!target) return 0;
    const doctor = await this.doctors.findById(doctorId, { name: 1, slug: 1 }).exec();
    if (!doctor) return 0;
    // Web Push first once INT has a push provider; WhatsApp until then (TDD 6.4).
    const r = await this.notifications.notify({
      userId: target.patientUserId,
      template: 'turn_near',
      params: () => [
        doctorNameParam(doctor.name),
        String(TURN_NEAR_TOKENS),
        this.link(doctor, true),
      ],
      dedupeKey: `turn:${target._id.toHexString()}`,
      appointmentId: target._id,
      alert: true,
    });
    return r?.created ? 1 : 0;
  }
}
