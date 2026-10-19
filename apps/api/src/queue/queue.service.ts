import {
  OTP_REQUEST_LIMIT,
  OTP_REQUEST_WINDOW_SECONDS,
  type CheckInRequest,
  type QueueActionResponse,
  type QueueMoveRequest,
  type QueueNextRequest,
  type SendVisitOtpResponse,
} from '@doqto/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import { isValidObjectId, Model, Types } from 'mongoose';
import { toDaySheetItem } from '../appointments/appointment.mappers';
import {
  Appointment,
  AppointmentDocument,
  STATUS_HISTORY_MAX,
} from '../appointments/appointment.schema';
import { otpError, OtpChallengeService } from '../auth/otp-challenge.service';
import { ClinicAccessService } from '../clinics/clinic-access.service';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import {
  hashSecret,
  VISIT_CODE_LOCK_MINUTES,
  VISIT_CODE_MAX_ATTEMPTS,
  VISIT_CODES,
  type VisitCodes,
} from '../integrations';
import { DoctorStatusService, toDoctorStatus } from '../status/doctor-status.service';
import { User } from '../users/user.schema';

/** TDD 6.2: a booked patient within 10 minutes of the slot keeps the slot as queue position. */
export const ON_TIME_GRACE_MS = 10 * 60_000;
/** Reviews unlock 24 hours after the consult (TDD 5.2). */
export const REVIEW_UNLOCK_MS = 24 * 3600_000;
const OTP_WINDOW_MS = OTP_REQUEST_WINDOW_SECONDS * 1000;

const conflict = (message: string) => new AppException(HttpStatus.CONFLICT, 'CONFLICT', message);
const history = (status: string, at: Date, by: string, note?: string) => ({
  $push: {
    statusHistory: {
      $each: [{ status, at, by: new Types.ObjectId(by), ...(note ? { note } : {}) }],
      $slice: -STATUS_HISTORY_MAX,
    },
  },
});

/** TDD 6.2 effective time: the slot if on time (10 minutes grace), else the check-in time. */
export function effectiveTime(slotStart: Date | undefined, checkInAt: Date): Date {
  return slotStart && checkInAt.getTime() <= slotStart.getTime() + ON_TIME_GRACE_MS
    ? slotStart
    : checkInAt;
}

/** BE-16 check-in and BE-17 queue actions for the clinic console. */
@Injectable()
export class QueueService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(VISIT_CODES) private readonly visitCodes: VisitCodes,
    @InjectThrottlerStorage() private readonly limiter: ThrottlerStorage,
    private readonly challenges: OtpChallengeService,
    private readonly access: ClinicAccessService,
    private readonly status: DoctorStatusService,
    private readonly config: AppConfig,
  ) {}

  /** An appointment of a clinic the caller works at. Someone else's is a 404, never a 403. */
  async loadForTeam(userId: string, appointmentId: string): Promise<AppointmentDocument> {
    const a = isValidObjectId(appointmentId)
      ? await this.appointments.findById(appointmentId).exec()
      : null;
    if (!a) throw AppException.notFound('Appointment not found');
    try {
      await this.access.requireClinic(userId, a.clinicId);
    } catch {
      throw AppException.notFound('Appointment not found');
    }
    return a;
  }

  private assertToday(a: AppointmentDocument, now: Date): void {
    if (a.date !== istDate(now))
      throw conflict('Check-in and the queue work only on the appointment day');
  }

  private assertWaitingToCheckIn(a: AppointmentDocument): void {
    if (a.status === 'checked_in' || a.status === 'in_consult')
      throw conflict('Already checked in');
    if (a.status !== 'confirmed') throw conflict('This appointment cannot be checked in');
  }

  /** `POST /clinic/queue/:id/send-otp`: walk-ins and manual bookings prove the visit by phone. */
  async sendVisitOtp(
    userId: string,
    appointmentId: string,
    now = new Date(),
  ): Promise<SendVisitOtpResponse> {
    const a = await this.loadForTeam(userId, appointmentId);
    this.assertToday(a, now);
    this.assertWaitingToCheckIn(a);
    const key = `visit-otp-phone:${hashSecret(this.config.get('HASH_PEPPER'), 'ratelimit', a.patientPhone)}`;
    const rec = await this.limiter.increment(
      key,
      OTP_WINDOW_MS,
      OTP_REQUEST_LIMIT,
      OTP_WINDOW_MS,
      'visit-otp',
    );
    if (rec.isBlocked) throw AppException.rateLimited(Math.max(1, rec.timeToBlockExpire));
    const patient = await this.users.findById(a.patientUserId, { language: 1 }).exec();
    const sent = await this.challenges.issue(a.patientPhone, 'visit', patient?.language ?? 'hi');
    return { expiresAt: sent.expiresAt.toISOString(), channel: sent.channel };
  }

  /**
   * Visit code check (DB doc 3.5 `visitCode`). The attempt is reserved atomically **before** the
   * code is compared, so the lockout also holds for the demo code 123456 and parallel guesses.
   */
  private async verifyVisitCode(a: AppointmentDocument, code: string, now: Date): Promise<void> {
    if (!a.visitCode?.hash) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'This booking has no visit code. Send an OTP to the patient instead.',
        { issues: [{ path: 'method', message: 'Use otp for this appointment' }] },
      );
    }
    if (a.visitCode.expiresAt && a.visitCode.expiresAt.getTime() < now.getTime())
      throw otpError('OTP_EXPIRED');
    // Out of attempts but no lock recorded (the request that used the last one died): lock now.
    await this.appointments
      .updateOne(
        {
          _id: a._id,
          'visitCode.attempts': { $gte: VISIT_CODE_MAX_ATTEMPTS },
          'visitCode.lockedUntil': { $exists: false },
        },
        {
          $set: {
            'visitCode.lockedUntil': new Date(now.getTime() + VISIT_CODE_LOCK_MINUTES * 60_000),
          },
        },
      )
      .exec();
    // A finished lock starts a fresh round of attempts.
    await this.appointments
      .updateOne(
        { _id: a._id, 'visitCode.lockedUntil': { $lte: now } },
        { $set: { 'visitCode.attempts': 0 }, $unset: { 'visitCode.lockedUntil': 1 } },
      )
      .exec();
    const reserved = await this.appointments
      .findOneAndUpdate(
        {
          _id: a._id,
          'visitCode.attempts': { $lt: VISIT_CODE_MAX_ATTEMPTS },
          'visitCode.lockedUntil': { $exists: false },
        },
        { $inc: { 'visitCode.attempts': 1 } },
        { new: true },
      )
      .exec();
    if (!reserved?.visitCode) throw otpError('OTP_LOCKED');
    if (this.visitCodes.matches(a._id.toHexString(), code, reserved.visitCode.hash)) {
      await this.appointments
        .updateOne({ _id: a._id }, { $set: { 'visitCode.attempts': 0 } })
        .exec();
      return;
    }
    const used = reserved.visitCode.attempts;
    if (used >= VISIT_CODE_MAX_ATTEMPTS) {
      await this.appointments
        .updateOne(
          { _id: a._id },
          {
            $set: {
              'visitCode.lockedUntil': new Date(now.getTime() + VISIT_CODE_LOCK_MINUTES * 60_000),
            },
          },
        )
        .exec();
      throw otpError('OTP_LOCKED');
    }
    throw otpError('OTP_INVALID', VISIT_CODE_MAX_ATTEMPTS - used);
  }

  /** BE-16: verify the visit, then assign the next token with an atomic `$inc`. */
  async checkIn(
    userId: string,
    body: CheckInRequest,
    now = new Date(),
  ): Promise<QueueActionResponse> {
    const a = await this.loadForTeam(userId, body.appointmentId);
    this.assertToday(a, now);
    this.assertWaitingToCheckIn(a);
    if (body.method === 'visit_code') await this.verifyVisitCode(a, body.code, now);
    else await this.challenges.consume(a.patientPhone, 'visit', body.code);

    const claimed = await this.appointments
      .findOneAndUpdate(
        { _id: a._id, status: 'confirmed' },
        {
          $set: {
            status: 'checked_in',
            checkInAt: now,
            visitVerifiedAt: now,
            effectiveTime: effectiveTime(a.slotStart, now),
          },
          ...history('checked_in', now, userId),
        },
        { new: true },
      )
      .exec();
    if (!claimed) throw conflict('Already checked in');
    const token = await this.status.nextToken(a.doctorId, a.clinicId, a.date);
    const withToken = (await this.appointments
      .findOneAndUpdate({ _id: a._id }, { $set: { queueToken: token } }, { new: true })
      .exec())!;
    const st = await this.status.recount(a.doctorId, a.clinicId, a.date);
    return {
      appointment: toDaySheetItem(withToken),
      completed: null,
      status: toDoctorStatus(st, a.doctorId, a.date),
    };
  }

  /** BE-17 `next`: complete the consult in progress (recording its length) and call the next patient. */
  async next(
    userId: string,
    body: QueueNextRequest,
    now = new Date(),
  ): Promise<QueueActionResponse> {
    const { clinic, doctor } = await this.access.require(userId, body.clinicId, body.doctorId);
    const date = istDate(now);
    const scope = { doctorId: doctor._id, clinicId: clinic._id, date };
    return this.status.withQueueLock(doctor._id, clinic._id, date, async () => {
      const current = await this.appointments.findOne({ ...scope, status: 'in_consult' }).exec();
      if (body.currentAppointmentId !== undefined) {
        const actual = current?._id.toHexString() ?? null;
        if (actual !== body.currentAppointmentId)
          throw conflict('The queue has already moved. Refresh.');
      }
      let completed: AppointmentDocument | null = null;
      if (current) {
        completed = await this.appointments
          .findOneAndUpdate(
            { _id: current._id, status: 'in_consult' },
            {
              $set: {
                status: 'completed',
                consultEndAt: now,
                reviewUnlockAt: new Date(now.getTime() + REVIEW_UNLOCK_MS),
              },
              ...history('completed', now, userId),
            },
            { new: true },
          )
          .exec();
        if (completed && current.consultStartAt) {
          await this.status.recordConsult(
            doctor._id,
            date,
            (now.getTime() - current.consultStartAt.getTime()) / 60_000,
          );
        }
      }
      const called = await this.appointments
        .findOneAndUpdate(
          { ...scope, status: 'checked_in' },
          {
            $set: { status: 'in_consult', consultStartAt: now },
            ...history('in_consult', now, userId),
          },
          { sort: { effectiveTime: 1, queueToken: 1 }, new: true },
        )
        .exec();
      const st = await this.status.recount(doctor._id, clinic._id, date);
      return {
        appointment: called ? toDaySheetItem(called) : null,
        completed: completed ? toDaySheetItem(completed) : null,
        status: toDoctorStatus(st, doctor._id, date),
      };
    });
  }

  /** BE-17 `no-show`: skip a booked or waiting patient. */
  async noShow(
    userId: string,
    appointmentId: string,
    now = new Date(),
  ): Promise<QueueActionResponse> {
    const a = await this.loadForTeam(userId, appointmentId);
    this.assertToday(a, now);
    return this.status.withQueueLock(a.doctorId, a.clinicId, a.date, async () => {
      const updated = await this.appointments
        .findOneAndUpdate(
          { _id: a._id, status: { $in: ['confirmed', 'checked_in'] } },
          { $set: { status: 'no_show' }, ...history('no_show', now, userId) },
          { new: true },
        )
        .exec();
      if (!updated) throw conflict('Only a booked or waiting patient can be marked as no-show');
      const st = await this.status.recount(a.doctorId, a.clinicId, a.date);
      return {
        appointment: toDaySheetItem(updated),
        completed: null,
        status: toDoctorStatus(st, a.doctorId, a.date),
      };
    });
  }

  /** BE-17 reorder (emergency, elderly): place a waiting patient right before another; logged. */
  async move(
    userId: string,
    appointmentId: string,
    body: QueueMoveRequest,
    now = new Date(),
  ): Promise<QueueActionResponse> {
    const a = await this.loadForTeam(userId, appointmentId);
    this.assertToday(a, now);
    const scope = { doctorId: a.doctorId, clinicId: a.clinicId, date: a.date };
    return this.status.withQueueLock(a.doctorId, a.clinicId, a.date, async () => {
      const waiting = await this.appointments
        .find({ ...scope, status: 'checked_in' })
        .sort({ effectiveTime: 1, queueToken: 1 })
        .exec();
      const target = waiting.find((w) => w._id.equals(a._id));
      const beforeIdx = waiting.findIndex((w) => w._id.toHexString() === body.beforeAppointmentId);
      const before = waiting[beforeIdx];
      if (!target || !before || target._id.equals(before._id)) {
        throw conflict('Both patients must be waiting in this queue');
      }
      const others = waiting.filter((w) => !w._id.equals(a._id));
      const prev = others[others.indexOf(before) - 1];
      const beforeMs = before.effectiveTime!.getTime();
      // Midpoint between the neighbours keeps everyone else's order; a minute earlier at the front.
      const at = prev
        ? Math.floor((prev.effectiveTime!.getTime() + beforeMs) / 2)
        : beforeMs - 60_000;
      const note =
        `moved before token ${before.queueToken ?? '?'}${body.reason ? `: ${body.reason}` : ''}`.slice(
          0,
          120,
        );
      const updated = (await this.appointments
        .findOneAndUpdate(
          { _id: a._id, status: 'checked_in' },
          { $set: { effectiveTime: new Date(at) }, ...history('checked_in', now, userId, note) },
          { new: true },
        )
        .exec())!;
      const st = await this.status.recount(a.doctorId, a.clinicId, a.date);
      return {
        appointment: toDaySheetItem(updated),
        completed: null,
        status: toDoctorStatus(st, a.doctorId, a.date),
      };
    });
  }
}
