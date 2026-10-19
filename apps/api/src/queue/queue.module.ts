import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { StatusModule } from '../status/status.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundRequests } from '../appointments/refund-requests.service';
import { StatusAlertsService } from './status-alerts.service';
import { ClinicConsoleController } from './clinic-console.controller';
import { FrontDeskService } from './front-desk.service';
import { QueueService } from './queue.service';

/** Clinic console: day sheet and entries (BE-15), check-in (BE-16), queue (BE-17), status (BE-18). */
@Module({
  imports: [
    AuthModule,
    ClinicsModule,
    NotificationsModule,
    SchedulesModule,
    StatusModule,
    UsersModule,
  ],
  controllers: [ClinicConsoleController],
  providers: [FrontDeskService, QueueService, StatusAlertsService, RefundRequests],
})
export class QueueModule {}
