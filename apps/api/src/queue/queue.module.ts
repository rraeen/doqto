import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ConsoleAuthModule } from '../console-auth/console-auth.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { StatusModule } from '../status/status.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { RefundRequests } from '../appointments/refund-requests.service';
import { StatusAlertsService } from './status-alerts.service';
import { ClinicConsoleController } from './clinic-console.controller';
import { ConsoleClinicController } from './console-clinic.controller';
import { ConsoleClinicService } from './console-clinic.service';
import { FrontDeskService } from './front-desk.service';
import { QueueService } from './queue.service';

/** Clinic console: day sheet and entries (BE-15), check-in (BE-16), queue (BE-17), status (BE-18). */
@Module({
  imports: [
    AppointmentsModule,
    AuthModule,
    ClinicsModule,
    ConsoleAuthModule,
    NotificationsModule,
    PaymentsModule,
    SchedulesModule,
    StatusModule,
    UsersModule,
  ],
  controllers: [ClinicConsoleController, ConsoleClinicController],
  providers: [
    FrontDeskService,
    QueueService,
    StatusAlertsService,
    RefundRequests,
    ConsoleClinicService,
  ],
})
export class QueueModule {}
