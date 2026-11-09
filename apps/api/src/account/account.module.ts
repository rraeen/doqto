import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { RecordsModule } from '../records/records.module';
import { AccountController, TransparencyController } from './account.controller';
import { AccountService } from './account.service';

/** What a patient can do about their own data: devices, export, deletion, and the public numbers. */
@Module({
  imports: [AppointmentsModule, AuthModule, ChatModule, RecordsModule],
  controllers: [AccountController, TransparencyController],
  providers: [AccountService],
})
export class AccountModule {}
