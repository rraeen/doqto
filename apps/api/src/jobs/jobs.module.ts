import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StatusModule } from '../status/status.module';
import { EndOfDayService } from './end-of-day.service';
import { JobRunner } from './job-runner.service';
import { JobsService } from './jobs.service';

/** BE-19 jobs framework and BE-20 end-of-day close. Later stories register their own handlers. */
@Module({
  imports: [ScheduleModule.forRoot(), StatusModule],
  providers: [JobsService, JobRunner, EndOfDayService],
  exports: [JobsService, JobRunner],
})
export class JobsModule {}
