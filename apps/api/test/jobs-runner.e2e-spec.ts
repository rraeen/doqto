import './enable-jobs';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { type Connection, type Model } from 'mongoose';
import { addDays, istDate } from '../src/common/time/ist';
import { endOfDayKey } from '../src/jobs/end-of-day.service';
import { Job } from '../src/jobs/job.schema';
import { createTestApp } from './app';

describe('job runner with JOBS_ENABLED (BE-19)', () => {
  let app: INestApplication;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  it('starts the cron and catches up yesterday on boot, run by the poller', async () => {
    expect(app.get(SchedulerRegistry).getCronJob('end-of-day').isActive).toBe(true);
    const jobs: Model<Job> = app.get(getModelToken(Job.name));
    const key = endOfDayKey(addDays(istDate(), -1));
    let job = await jobs.findOne({ dedupeKey: key }).lean();
    for (let i = 0; i < 50 && job?.status !== 'done'; i++) {
      await new Promise((r) => setTimeout(r, 100));
      job = await jobs.findOne({ dedupeKey: key }).lean();
    }
    expect(job?.status).toBe('done');
  });
});
