import { Module } from '@nestjs/common';
import { DoctorStatusService } from './doctor-status.service';
import { PublicStatusController } from './public-status.controller';

/** BE-18 live doctor status (`doctorStatus`, `statusEvents`). Staff updates live in the clinic console. */
@Module({
  controllers: [PublicStatusController],
  providers: [DoctorStatusService],
  exports: [DoctorStatusService],
})
export class StatusModule {}
