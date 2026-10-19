import { Module } from '@nestjs/common';
import { DoctorsModule } from '../doctors/doctors.module';
import { ClinicAccessService } from './clinic-access.service';
import { ClinicScopeGuard } from './clinic-scope.guard';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { GeoController } from './geo.controller';

@Module({
  imports: [DoctorsModule],
  controllers: [ClinicsController, GeoController],
  providers: [ClinicsService, ClinicScopeGuard, ClinicAccessService],
  exports: [ClinicScopeGuard, ClinicAccessService],
})
export class ClinicsModule {}
