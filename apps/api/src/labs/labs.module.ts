import { Module } from '@nestjs/common';
import { ConsoleAuthModule } from '../console-auth/console-auth.module';
import { ConsoleLabService } from './console-lab.service';
import { ConsoleLabController, LabsController, MyLabBookingsController } from './labs.controller';
import { LabsService } from './labs.service';

/**
 * Labs: the public list and booking requests for patients, and the lab's own catalogue, bookings,
 * sample collection and reports in the console. Listings are written when Doqto approves a lab
 * application (`UnitPublishingService`).
 */
@Module({
  imports: [ConsoleAuthModule],
  controllers: [LabsController, MyLabBookingsController, ConsoleLabController],
  providers: [LabsService, ConsoleLabService],
  exports: [LabsService],
})
export class LabsModule {}
