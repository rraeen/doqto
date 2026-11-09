import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic } from '../clinics/clinic.schema';
import { addDays, istDate, istDateTime } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { JobRunner } from '../jobs/job-runner.service';
import { doctorNameParam, timeParam } from '../notifications/message-format';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment } from './appointment.schema';

/** The evening reminder goes out from 6 pm IST the day before. */
const EVENING_HOUR = '18:00';
const TWO_HOURS = 2 * 3_600_000;

/**
 * BE-30 reminders for confirmed bookings (TDD 6.1 step 6): the evening before (if the booking was
 * made earlier than that) and 2 hours before. Each message has a dedupe key, so running the job
 * often, or on several instances, still sends each one once.
 */
@Injectable()
export class RemindersService implements OnModuleInit {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    private readonly notifications: NotificationsService,
    private readonly runner: JobRunner,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.runner.every('booking-reminders', 5 * 60_000, async () => {
      await this.run();
    });
  }

  async run(now = new Date()): Promise<{ twoHours: number; dayBefore: number }> {
    let twoHours = 0;
    let dayBefore = 0;

    const soon = await this.appointments
      .find({
        status: 'confirmed',
        slotStart: { $gt: now, $lte: new Date(now.getTime() + TWO_HOURS) },
      })
      .limit(500)
      .lean()
      .exec();
    for (const a of soon) {
      if (await this.send('reminder_two_hours', `rem2h:${a._id.toHexString()}`, a)) twoHours++;
    }

    const eveningStart = istDateTime(istDate(now), EVENING_HOUR);
    if (now.getTime() >= eveningStart.getTime()) {
      const tomorrow = addDays(istDate(now), 1);
      const next = await this.appointments
        // Booked before this evening; later ones were just confirmed, so a reminder is noise.
        .find({ status: 'confirmed', date: tomorrow, createdAt: { $lt: eveningStart } })
        .limit(500)
        .lean()
        .exec();
      for (const a of next) {
        if (await this.send('reminder_day_before', `rem1d:${a._id.toHexString()}`, a)) dayBefore++;
      }
    }
    return { twoHours, dayBefore };
  }

  private async send(
    template: 'reminder_two_hours' | 'reminder_day_before',
    dedupeKey: string,
    a: {
      _id: Types.ObjectId;
      patientUserId: Types.ObjectId;
      doctorId: Types.ObjectId;
      clinicId: Types.ObjectId;
      slotStart?: Date;
    },
  ): Promise<boolean> {
    if (!a.slotStart) return false;
    const start = a.slotStart;
    const [doctor, clinic] = await Promise.all([
      this.doctors.findById(a.doctorId, { name: 1 }).lean().exec(),
      this.clinics.findById(a.clinicId, { name: 1, 'address.area': 1 }).lean().exec(),
    ]);
    const r = await this.notifications.notify({
      userId: a.patientUserId,
      template,
      params: (language) => [
        doctorNameParam(doctor?.name ?? ''),
        [clinic?.name, clinic?.address?.area].filter(Boolean).join(', '),
        timeParam(start, language),
        `${this.config.get('WEB_PUBLIC_URL')}/appointments/${a._id.toHexString()}`,
      ],
      dedupeKey,
      appointmentId: a._id,
    });
    return r?.created === true;
  }
}
