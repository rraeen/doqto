import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewJobs } from './review-jobs.service';
import { DoctorReviewsController, ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Reviews (BE-33 to BE-38). Never imports the payments module: nothing a doctor pays can change
 * which reviews show or how they count (TDD 5.8).
 */
@Module({
  imports: [JobsModule, NotificationsModule],
  controllers: [ReviewsController, DoctorReviewsController],
  providers: [ReviewJobs, ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
