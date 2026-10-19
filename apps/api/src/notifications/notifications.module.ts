import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationSender } from './notification-sender.service';
import {
  AdminNotificationsController,
  MyNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

/** BE-21 outbox and sender. Other modules import it and call `NotificationsService.notify()`. */
@Module({
  imports: [JobsModule],
  controllers: [MyNotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationSender],
  exports: [NotificationsService],
})
export class NotificationsModule {}
