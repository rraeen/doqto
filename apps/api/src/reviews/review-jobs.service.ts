import { REVIEW_UNLOCK_HOURS, REVIEW_WINDOW_DAYS } from '@doqto/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment } from '../appointments/appointment.schema';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { JobRunner } from '../jobs/job-runner.service';
import { dateParam, doctorNameParam } from '../notifications/message-format';
import { NotificationsService } from '../notifications/notifications.service';
import { Review } from './review.schema';

const DAY = 86_400_000;
/** The nudge goes out on day 5 after the form opens, once, never again (TDD 5.2). */
const REMINDER_AFTER_DAYS = 5;

/**
 * BE-38: tells the patient when the review form opens and once more on day 5. Each message has a
 * dedupe key, so catching up after downtime, or running on two instances, sends each only once.
 */
@Injectable()
export class ReviewJobs implements OnModuleInit {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    private readonly notifications: NotificationsService,
    private readonly runner: JobRunner,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.runner.every('review-nudges', 10 * 60_000, async () => {
      await this.run();
    });
  }

  async run(now = new Date()): Promise<{ opened: number; reminded: number }> {
    // `reviewUnlockAt` is when the form opens (visit end + 24 h).
    const opened = await this.nudge(
      new Date(now.getTime() - 1 * DAY),
      now,
      'review_open',
      'review-open',
      now,
    );
    const reminded = await this.nudge(
      new Date(now.getTime() - (REMINDER_AFTER_DAYS + 1) * DAY),
      new Date(now.getTime() - REMINDER_AFTER_DAYS * DAY),
      'review_reminder',
      'review-remind',
      now,
    );
    return { opened, reminded };
  }

  private async nudge(
    from: Date,
    to: Date,
    template: 'review_open' | 'review_reminder',
    key: string,
    now: Date,
  ): Promise<number> {
    const visits = await this.appointments
      .find({
        status: 'completed',
        visitVerifiedAt: { $exists: true },
        reviewUnlockAt: { $gt: from, $lte: to },
      })
      .limit(500)
      .lean()
      .exec();
    if (visits.length === 0) return 0;
    const done = new Set(
      (
        await this.reviews
          .find({ appointmentId: { $in: visits.map((v) => v._id) } }, { appointmentId: 1 })
          .lean()
          .exec()
      ).map((r) => r.appointmentId.toHexString()),
    );
    const doctors = new Map(
      (
        await this.doctors
          .find({ _id: { $in: visits.map((v) => v.doctorId) } }, { name: 1 })
          .lean()
          .exec()
      ).map((d) => [d._id.toHexString(), d.name]),
    );
    let sent = 0;
    for (const v of visits) {
      if (done.has(v._id.toHexString()) || !v.reviewUnlockAt) continue;
      const link = `${this.config.get('WEB_PUBLIC_URL')}/appointments/${v._id.toHexString()}/review`;
      const doctor = doctorNameParam(doctors.get(v.doctorId.toHexString()) ?? '');
      const closes = new Date(v.reviewUnlockAt.getTime() + REVIEW_WINDOW_DAYS * DAY);
      const r = await this.notifications.notify({
        userId: v.patientUserId,
        template,
        params: (language) =>
          template === 'review_open'
            ? [doctor, link]
            : [doctor, dateParam(closes.toISOString().slice(0, 10), language), link],
        dedupeKey: `${key}:${v._id.toHexString()}`,
        appointmentId: v._id,
        sendAfter: now,
      });
      if (r?.created) sent++;
    }
    return sent;
  }
}

// The unlock delay is part of the contract; keep this file honest if it ever changes.
export const REVIEW_OPEN_DELAY_HOURS = REVIEW_UNLOCK_HOURS;
