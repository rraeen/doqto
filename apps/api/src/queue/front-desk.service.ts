import {
  CreateClinicAppointmentRequestSchema,
  type DaySheetItem,
  type DaySheetQuery,
  type DaySheetResponse,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { compareForDaySheet, toDaySheetItem } from '../appointments/appointment.mappers';
import { Appointment, STATUS_HISTORY_MAX } from '../appointments/appointment.schema';
import { ClinicAccessService } from '../clinics/clinic-access.service';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { addDays, istDate } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import { SchedulesService } from '../schedules/schedules.service';
import { expandSlots } from '../schedules/slots';
import { DoctorStatusService, toDoctorStatus } from '../status/doctor-status.service';
import { UsersService } from '../users/users.service';

/** Manual bookings can be entered up to this many days ahead (the schedule window is for online). */
export const MANUAL_BOOKING_DAYS_MAX = 30;
const DAY_SHEET_MAX = 500;

const invalid = (path: string, message: string) =>
  new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', message, {
    issues: [{ path, message }],
  });

/** BE-15 front desk: the day sheet and walk-in / WhatsApp / phone entries (TDD 6.1, no fee). */
@Injectable()
export class FrontDeskService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    private readonly access: ClinicAccessService,
    private readonly schedules: SchedulesService,
    private readonly status: DoctorStatusService,
    private readonly users: UsersService,
    private readonly config: AppConfig,
  ) {}

  async daySheet(userId: string, q: DaySheetQuery): Promise<DaySheetResponse> {
    const date = q.date ?? istDate();
    const filter: Record<string, unknown> = { date };
    let doctorId: Types.ObjectId | undefined;
    if (q.doctorId) {
      const scope = await this.access.require(userId, q.clinicId, q.doctorId);
      doctorId = scope.doctor._id;
      filter.clinicId = scope.clinic._id;
      filter.doctorId = doctorId;
    } else {
      filter.clinicId = (await this.access.requireClinic(userId, q.clinicId)).clinic._id;
    }
    const rows = await this.appointments.find(filter).limit(DAY_SHEET_MAX).exec();
    rows.sort(compareForDaySheet);
    return {
      date,
      items: rows.map(toDaySheetItem),
      status: doctorId
        ? toDoctorStatus(await this.status.find(doctorId, date), doctorId, date)
        : null,
    };
  }

  async create(userId: string, raw: unknown, now = new Date()): Promise<DaySheetItem> {
    const body = zodCheck(CreateClinicAppointmentRequestSchema, raw);
    const { clinic, doctor } = await this.access.require(userId, body.clinicId, body.doctorId);
    const today = istDate(now);
    const date = body.date ?? today;
    if (body.source === 'walk_in' && date !== today)
      throw invalid('date', 'Walk-ins are for today');
    if (date < today || date > addDays(today, MANUAL_BOOKING_DAYS_MAX)) {
      throw invalid('date', `Pick today or a day in the next ${MANUAL_BOOKING_DAYS_MAX} days`);
    }

    let slot: { start: Date; end: Date } | undefined;
    if (body.slotStart) {
      const start = new Date(body.slotStart);
      if (istDate(start) !== date) throw invalid('slotStart', 'slotStart is not on that date');
      const schedule = await this.schedules.forDoctorAtClinic(doctor._id, clinic._id);
      slot = schedule
        ? expandSlots(schedule, date).find((s) => s.start.getTime() === start.getTime())
        : undefined;
      if (!slot) throw invalid('slotStart', 'That time is not a slot on the schedule');
    }

    const patient = await this.users.matchOrCreatePatient(body.patientPhone, body.patientName);
    try {
      const created = await this.appointments.create({
        doctorId: doctor._id,
        clinicId: clinic._id,
        patientUserId: patient._id,
        patientName: body.patientName,
        patientPhone: body.patientPhone,
        date,
        slotStart: slot?.start,
        slotEnd: slot?.end,
        source: body.source,
        status: 'confirmed',
        statusHistory: [{ status: 'confirmed', at: now, by: new Types.ObjectId(userId) }].slice(
          -STATUS_HISTORY_MAX,
        ),
        isDemo: this.config.isDemo,
      });
      return toDaySheetItem(created);
    } catch (e) {
      // The unique partial index on { doctorId, slotStart } (DB doc 5).
      if ((e as { code?: number }).code === 11000) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'SLOT_TAKEN',
          'That slot was just booked. Pick another.',
        );
      }
      throw e;
    }
  }
}
