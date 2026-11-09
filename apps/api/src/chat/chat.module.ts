import { Module } from '@nestjs/common';
import { ConsoleAuthModule } from '../console-auth/console-auth.module';
import { ChatController, ConsoleChatController } from './chat.controller';
import { ChatService } from './chat.service';

/** Chat between a patient and the doctor of a booking: the patient routes and the console routes. */
@Module({
  imports: [ConsoleAuthModule],
  controllers: [ChatController, ConsoleChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
