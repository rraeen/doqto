import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobRunner } from '../jobs/job-runner.service';
import { PaymentsService } from './payments.service';

/** Recurring work for payments. Runs only when `JOBS_ENABLED` (see `JobRunner.every`). */
@Injectable()
export class PaymentJobs implements OnModuleInit {
  constructor(
    private readonly runner: JobRunner,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    // A refund the gateway refused (or could not be reached for) is tried again every 10 minutes.
    this.runner.every('retry-owed-refunds', 10 * 60_000, async () => {
      await this.payments.retryOwedRefunds();
    });
  }
}
