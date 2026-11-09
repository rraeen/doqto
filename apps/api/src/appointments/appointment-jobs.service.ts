import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobRunner } from '../jobs/job-runner.service';
import { BookingService } from './booking.service';

/** Recurring work for bookings. Runs only when `JOBS_ENABLED` (see `JobRunner.every`). */
@Injectable()
export class AppointmentJobs implements OnModuleInit {
  constructor(
    private readonly runner: JobRunner,
    private readonly booking: BookingService,
  ) {}

  onModuleInit(): void {
    // TDD 6.1 step 5: a job every minute releases holds older than 10 minutes.
    this.runner.every('expire-holds', 60_000, async () => {
      await this.booking.expireHolds();
    });
  }
}
