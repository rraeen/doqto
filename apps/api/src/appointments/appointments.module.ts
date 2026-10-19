import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { StatusModule } from '../status/status.module';
import { AppointmentsController } from './appointments.controller';
import { PositionService } from './position.service';

/** Patient-facing appointment routes. BE-18: queue position. Booking arrives in sprint 5. */
@Module({
  imports: [ClinicsModule, StatusModule],
  controllers: [AppointmentsController],
  providers: [PositionService],
})
export class AppointmentsModule {}
