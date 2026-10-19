import { Module } from '@nestjs/common';
import { DoctorsModule } from '../doctors/doctors.module';
import { AdminDoctorsController } from './admin-doctors.controller';
import { AdminDoctorsService } from './admin-doctors.service';

/** Admin panel API (founder-only at first). Every route requires role `admin`. */
@Module({
  imports: [DoctorsModule],
  controllers: [AdminDoctorsController],
  providers: [AdminDoctorsService],
})
export class AdminModule {}
