import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { addDays, istDate } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import { END_OF_DAY_JOB, endOfDayKey } from './end-of-day.service';
import { JobsService } from './jobs.service';

const POLL = 'jobs-poll';
const END_OF_DAY_CRON = 'end-of-day';

/**
 * Runs the worker loop and the crons in the API process (TDD 2) when `JOBS_ENABLED`. Crons only
 * enqueue, with a dedupe key, so several instances still close each day once.
 */
@Injectable()
export class JobRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobRunner.name);
  private busy = false;
  private readonly recurring: {
    name: string;
    ms: number;
    run: () => Promise<void>;
    busy: boolean;
  }[] = [];

  constructor(
    private readonly jobs: JobsService,
    private readonly config: AppConfig,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    // Catch up when the process was down at 23:45 yesterday.
    await this.enqueueEndOfDay(addDays(istDate(), -1));
    this.registry.getCronJob(END_OF_DAY_CRON).start();
    this.registry.addInterval(
      POLL,
      setInterval(() => void this.tick(), this.config.get('JOB_POLL_MS')),
    );
    for (const r of this.recurring) {
      this.registry.addInterval(
        r.name,
        setInterval(() => void this.runRecurring(r), r.ms),
      );
    }
  }

  /**
   * Work that polls on its own clock (e.g. the 10-second notification sender). Register in
   * `onModuleInit`; it runs only when `JOBS_ENABLED`, never overlapping itself.
   */
  every(name: string, ms: number, run: () => Promise<void>): void {
    this.recurring.push({ name, ms, run, busy: false });
  }

  private async runRecurring(r: { name: string; run: () => Promise<void>; busy: boolean }) {
    if (r.busy) return;
    r.busy = true;
    try {
      await r.run();
    } catch (e) {
      this.logger.error(`${r.name} failed: ${e instanceof Error ? e.name : 'error'}`);
    } finally {
      r.busy = false;
    }
  }

  onApplicationShutdown(): void {
    for (const name of [POLL, ...this.recurring.map((r) => r.name)]) {
      if (this.registry.doesExist('interval', name)) this.registry.deleteInterval(name);
    }
  }

  /** Started only when jobs are enabled (see bootstrap). */
  @Cron('45 23 * * *', { name: END_OF_DAY_CRON, timeZone: 'Asia/Kolkata', disabled: true })
  async endOfDayCron(): Promise<void> {
    await this.enqueueEndOfDay(istDate());
  }

  enqueueEndOfDay(date: string): Promise<unknown> {
    return this.jobs.enqueue(END_OF_DAY_JOB, { date }, { dedupeKey: endOfDayKey(date) });
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.jobs.drain();
    } catch (e) {
      this.logger.error(`Job poll failed: ${e instanceof Error ? e.name : 'error'}`);
    } finally {
      this.busy = false;
    }
  }
}
