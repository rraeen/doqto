import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

/** BE-14 schedules (weekly template and exceptions). */
@Module({
  imports: [ClinicsModule, DoctorsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
