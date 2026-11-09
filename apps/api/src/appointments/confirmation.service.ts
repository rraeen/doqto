import { type ConfirmAppointmentResponse } from '@doqto/shared';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ClinicAccessService } from '../clinics/clinic-access.service';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { istDayRange } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { VISIT_CODES, type VisitCodes } from '../integrations';
import { dateParam, doctorNameParam, timeParam } from '../notifications/message-format';
import { NotificationsService } from '../notifications/notifications.service';
import { toAppointment } from './appointment.mappers';
import { Appointment, AppointmentDocument } from './appointment.schema';
import { conflict, historyEntry } from './booking.service';
import { VisitCodeVault } from './visit-code-vault';

/**
 * BE-27: the doctor (or the clinic's staff) accepts a paid booking. That is the moment the 4-digit
 * visit code exists: its hash goes on the appointment for the front desk's check, a sealed copy
 * lets the patient read it again, and the patient gets it by WhatsApp or SMS.
 */
@Injectable()
export class ConfirmationService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    @Inject(VISIT_CODES) private readonly visitCodes: VisitCodes,
    private readonly access: ClinicAccessService,
    private readonly notifications: NotificationsService,
    private readonly vault: VisitCodeVault,
    private readonly config: AppConfig,
  ) {}

  /** Clinic team only: a patient can never confirm their own booking. */
  private async authorise(userId: string, id: string): Promise<AppointmentDocument> {
    const a = isValidObjectId(id) ? await this.appointments.findById(id).exec() : null;
    if (!a) throw AppException.notFound('Appointment not found');
    try {
      await this.access.requireClinic(userId, a.clinicId);
      return a;
    } catch {
      throw AppException.notFound('Appointment not found');
    }
  }

  async confirm(userId: string, id: string, now = new Date()): Promise<ConfirmAppointmentResponse> {
    const a = await this.authorise(userId, id);
    if (a.status === 'confirmed') return { appointment: toAppointment(a) };
    if (a.status !== 'pending_confirmation') {
      throw conflict('Only a paid booking waiting for the doctor can be confirmed');
    }

    const issued = this.visitCodes.issue(a.id);
    const updated = await this.appointments
      .findOneAndUpdate(
        { _id: a._id, status: 'pending_confirmation' },
        {
          $set: {
            status: 'confirmed',
            visitCode: {
              hash: issued.hash,
              expiresAt: istDayRange(a.date).end,
              attempts: 0,
            },
            visitCodeSealed: this.vault.seal(issued.code),
          },
          ...historyEntry('confirmed', now, userId, 'doctor confirmed'),
        },
        { new: true },
      )
      .exec();
    // Lost a race (confirmed twice, or cancelled a moment ago): report what it is now.
    if (!updated) {
      const current = await this.appointments.findById(a._id).exec();
      if (current?.status === 'confirmed') return { appointment: toAppointment(current) };
      throw conflict('This booking just changed. Refresh and try again.');
    }
    await this.notifyConfirmed(updated, issued.code);
    return { appointment: toAppointment(updated) };
  }

  private async notifyConfirmed(a: AppointmentDocument, code: string): Promise<void> {
    if (!a.slotStart) return;
    const [doctor, clinic] = await Promise.all([
      this.doctors.findById(a.doctorId, { name: 1 }).lean().exec(),
      this.clinics.findById(a.clinicId, { name: 1, 'address.area': 1 }).lean().exec(),
    ]);
    const start = a.slotStart;
    await this.notifications.notify({
      userId: a.patientUserId as Types.ObjectId,
      template: 'booking_confirmed',
      params: (language) => [
        doctorNameParam(doctor?.name ?? ''),
        [clinic?.name, clinic?.address?.area].filter(Boolean).join(', '),
        dateParam(a.date, language),
        timeParam(start, language),
        code,
        `${this.config.get('WEB_PUBLIC_URL')}/appointments/${a.id}`,
      ],
      secret: [4],
      dedupeKey: `confirmed:${a.id}`,
      appointmentId: a._id,
    });
  }
}
