import {
  UpdateStatusRequestSchema,
  type CheckInRequest,
  type ConfirmAppointmentResponse,
  type CreateClinicAppointmentRequest,
  type DaySheetItem,
  type DaySheetResponse,
  type DoctorStatus,
  type QueueActionResponse,
  type QueueMoveRequest,
  type SendVisitOtpResponse,
} from '@doqto/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { toDaySheetItem } from '../appointments/appointment.mappers';
import { Appointment } from '../appointments/appointment.schema';
import { ConfirmationService } from '../appointments/confirmation.service';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { WorkspacesService } from '../console-auth/workspaces.service';
import { zodCheck } from '../common/http/zod-check';
import { Doctor } from '../doctors/doctor.schema';
import { SchedulesService } from '../schedules/schedules.service';
import { DoctorStatusService } from '../status/doctor-status.service';
import { FrontDeskService } from './front-desk.service';
import { QueueService } from './queue.service';
import { StatusAlertsService } from './status-alerts.service';

/**
 * What an approved clinic or doctor sees in the console about their bookings: the day's list and
 * the bookings waiting for them to accept. It reuses the clinic console services (the same rules as
 * before: a confirmation creates the visit code and tells the patient), scoped to the one service
 * the signed-in account owns, so no clinic or doctor id is ever taken from the browser.
 */
@Injectable()
export class ConsoleClinicService {
  private readonly logger = new Logger(ConsoleClinicService.name);

  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    private readonly workspaces: WorkspacesService,
    private readonly desk: FrontDeskService,
    private readonly confirmation: ConfirmationService,
    private readonly queue: QueueService,
    private readonly status: DoctorStatusService,
    private readonly schedules: SchedulesService,
    private readonly alerts: StatusAlertsService,
  ) {}

  private async scope(accountId: string, unitId: string) {
    const unit = await this.workspaces.open(accountId, unitId);
    if (unit.kind !== 'clinic') throw AppException.notFound('This service has no bookings');
    if (unit.status !== 'verified') {
      throw AppException.forbidden('Bookings open once Doqto approves your application');
    }
    const uid = new Types.ObjectId(unitId);
    const [doctor, clinic] = await Promise.all([
      this.doctors.findOne({ unitId: uid }, { _id: 1 }).exec(),
      this.clinics.findOne({ unitId: uid }, { _id: 1 }).exec(),
    ]);
    if (!doctor || !clinic) throw AppException.notFound('Your listing is not ready yet');
    return { doctorId: doctor._id, clinicId: clinic._id };
  }

  /** One day's list (today when no date is given), in front-desk order. */
  async day(accountId: string, unitId: string, date?: string): Promise<DaySheetResponse> {
    const { doctorId, clinicId } = await this.scope(accountId, unitId);
    return this.desk.daySheet(accountId, {
      clinicId: clinicId.toHexString(),
      doctorId: doctorId.toHexString(),
      date,
    });
  }

  /** Paid bookings on any date that wait for the doctor to accept, earliest first. */
  async waiting(accountId: string, unitId: string): Promise<DaySheetItem[]> {
    const { doctorId } = await this.scope(accountId, unitId);
    const rows = await this.appointments
      .find({ doctorId, status: 'pending_confirmation' })
      .sort({ date: 1, slotStart: 1 })
      .limit(100)
      .exec();
    return rows.map(toDaySheetItem);
  }

  /** Accepted bookings from today on, any date, earliest first: what the doctor has coming up. */
  async upcoming(accountId: string, unitId: string): Promise<DaySheetItem[]> {
    const { doctorId } = await this.scope(accountId, unitId);
    const rows = await this.appointments
      .find({
        doctorId,
        date: { $gte: istDate() },
        status: { $in: ['confirmed', 'checked_in', 'in_consult'] },
      })
      .sort({ date: 1, slotStart: 1 })
      .limit(200)
      .exec();
    return rows.map(toDaySheetItem);
  }

  async confirm(
    accountId: string,
    unitId: string,
    appointmentId: string,
  ): Promise<ConfirmAppointmentResponse> {
    const { doctorId } = await this.scope(accountId, unitId);
    // Only a booking of this doctor: anything else looks like it does not exist.
    const mine =
      isValidObjectId(appointmentId) &&
      (await this.appointments.exists({ _id: appointmentId, doctorId }).exec());
    if (!mine) throw AppException.notFound('Appointment not found');
    return this.confirmation.confirm(accountId, appointmentId);
  }

  // ---- the visit day: check-in, calling the next patient, no-shows, the live status ----

  /** A booking of this doctor; anything else looks like it does not exist. */
  private async own(doctorId: Types.ObjectId, appointmentId: string): Promise<void> {
    const mine =
      isValidObjectId(appointmentId) &&
      (await this.appointments.exists({ _id: appointmentId, doctorId }).exec());
    if (!mine) throw AppException.notFound('Appointment not found');
  }

  /** Alerts never undo the action that triggered them; a failure is only logged. */
  private async alertQueue(r: QueueActionResponse): Promise<QueueActionResponse> {
    const { doctorId, clinicId, date } = r.status;
    if (clinicId) {
      await this.alerts
        .afterQueueChange(new Types.ObjectId(doctorId), new Types.ObjectId(clinicId), date)
        .catch((e: unknown) =>
          this.logger.warn(`Turn-near alert failed: ${e instanceof Error ? e.name : 'error'}`),
        );
    }
    return r;
  }

  /** The patient is at the clinic: the front desk checks them in with their code. */
  async checkIn(
    accountId: string,
    unitId: string,
    body: CheckInRequest,
  ): Promise<QueueActionResponse> {
    const { doctorId } = await this.scope(accountId, unitId);
    await this.own(doctorId, body.appointmentId);
    return this.queue.checkIn(accountId, body);
  }

  /** A walk-in or phone booking has no visit code: send the patient a code to read out. */
  async sendOtp(
    accountId: string,
    unitId: string,
    appointmentId: string,
  ): Promise<SendVisitOtpResponse> {
    const { doctorId } = await this.scope(accountId, unitId);
    await this.own(doctorId, appointmentId);
    return this.queue.sendVisitOtp(accountId, appointmentId);
  }

  /** Finishes the patient in consult (if any) and calls the next one. */
  async next(
    accountId: string,
    unitId: string,
    currentAppointmentId?: string | null,
  ): Promise<QueueActionResponse> {
    const { doctorId, clinicId } = await this.scope(accountId, unitId);
    return this.alertQueue(
      await this.queue.next(accountId, {
        clinicId: clinicId.toHexString(),
        doctorId: doctorId.toHexString(),
        currentAppointmentId,
      }),
    );
  }

  async noShow(
    accountId: string,
    unitId: string,
    appointmentId: string,
  ): Promise<QueueActionResponse> {
    const { doctorId } = await this.scope(accountId, unitId);
    await this.own(doctorId, appointmentId);
    return this.alertQueue(await this.queue.noShow(accountId, appointmentId));
  }

  /** Puts a waiting patient right before another waiting one (for example an emergency). */
  async move(
    accountId: string,
    unitId: string,
    appointmentId: string,
    body: QueueMoveRequest,
  ): Promise<QueueActionResponse> {
    const { doctorId } = await this.scope(accountId, unitId);
    await this.own(doctorId, appointmentId);
    await this.own(doctorId, body.beforeAppointmentId);
    return this.alertQueue(await this.queue.move(accountId, appointmentId, body));
  }

  /** A walk-in, or a booking taken over the phone or WhatsApp, with no online fee. */
  async addEntry(
    accountId: string,
    unitId: string,
    body: Omit<CreateClinicAppointmentRequest, 'clinicId' | 'doctorId'>,
  ): Promise<DaySheetItem> {
    const { doctorId, clinicId } = await this.scope(accountId, unitId);
    return this.desk.create(accountId, {
      ...body,
      clinicId: clinicId.toHexString(),
      doctorId: doctorId.toHexString(),
    });
  }

  /** The doctor's live status that patients see: in clinic, running late, on a break, done. */
  async updateStatus(
    accountId: string,
    unitId: string,
    raw: Record<string, unknown>,
  ): Promise<DoctorStatus> {
    const { doctorId, clinicId } = await this.scope(accountId, unitId);
    const body = zodCheck(UpdateStatusRequestSchema, {
      ...raw,
      clinicId: clinicId.toHexString(),
      doctorId: doctorId.toHexString(),
    });
    const schedule = await this.schedules.forDoctorAtClinic(doctorId, clinicId);
    const updated = await this.status.update(accountId, doctorId, clinicId, body, schedule);
    await this.alerts
      .afterStatusChange(doctorId, clinicId, updated.date)
      .catch((e: unknown) =>
        this.logger.warn(`Status alerts failed: ${e instanceof Error ? e.name : 'error'}`),
      );
    return updated;
  }
}
