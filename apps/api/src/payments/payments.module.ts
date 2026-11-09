import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentJobs } from './payment-jobs.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/** BE-27/28/29 booking-fee payments, the gateway event handler and refunds. */
@Module({
  imports: [JobsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentJobs, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
