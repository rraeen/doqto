import { Module } from '@nestjs/common';
import { DoctorProfileController } from './doctor-profile.controller';
import { DoctorSearchService } from '../search/doctor-search.service';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [DoctorsController, DoctorProfileController],
  providers: [DoctorsService, DoctorSearchService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
