import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { StatusModule } from '../status/status.module';
import { AppointmentJobs } from './appointment-jobs.service';
import { AppointmentsController, DoctorSlotsController } from './appointments.controller';
import { BookingService } from './booking.service';
import { ChangeService } from './change.service';
import { ConfirmationService } from './confirmation.service';
import { PositionService } from './position.service';
import { RemindersService } from './reminders.service';
import { SlotsService } from './slots.service';
import { VisitCodeVault } from './visit-code-vault';

/**
 * Patient-facing appointment routes: slots, booking with a 10-minute hold, my appointments,
 * cancel with refund, reschedule (BE-24 to BE-29), and queue position (BE-18). The doctor's
 * confirmation is exported for the clinic console route.
 */
@Module({
  imports: [
    ClinicsModule,
    JobsModule,
    NotificationsModule,
    PaymentsModule,
    SchedulesModule,
    StatusModule,
  ],
  controllers: [AppointmentsController, DoctorSlotsController],
  providers: [
    AppointmentJobs,
    BookingService,
    ChangeService,
    ConfirmationService,
    PositionService,
    RemindersService,
    SlotsService,
    VisitCodeVault,
  ],
  exports: [BookingService, ChangeService, ConfirmationService, VisitCodeVault],
})
export class AppointmentsModule {}
