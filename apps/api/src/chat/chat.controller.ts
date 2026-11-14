import type { ChatMessage, ChatMessagesResponse, ChatThreadsResponse } from '@doqto/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public } from '../auth/decorators';
import { AppException } from '../common/http/app-exception';
import {
  ConsoleAuthGuard,
  CurrentConsoleUser,
  type ConsoleUser,
} from '../console-auth/console-auth.guard';
import { requirePermission, WorkspacesService } from '../console-auth/workspaces.service';
import { Doctor } from '../doctors/doctor.schema';
import { ChatService } from './chat.service';
import { ChatAfterQueryDto, SendChatMessageDto } from './dto/chat.dto';

const SEND_LIMIT = { default: { limit: 30, ttl: 60_000 } };

/** The patient's side: conversations of their own bookings. */
@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ChatThreadsResponse> {
    return this.chat.list({ side: 'patient', userId: user.id });
  }

  @Get(':appointmentId')
  open(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') appointmentId: string,
    @Query() q: ChatAfterQueryDto,
  ): Promise<ChatMessagesResponse> {
    return this.chat.open({ side: 'patient', userId: user.id }, appointmentId, q.after);
  }

  @Post(':appointmentId')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(SEND_LIMIT)
  send(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') appointmentId: string,
    @Body() body: SendChatMessageDto,
  ): Promise<ChatMessage> {
    return this.chat.send({ side: 'patient', userId: user.id }, appointmentId, body);
  }
}

/**
 * The doctor's side, in the console: conversations of the bookings of the approved clinic or doctor
 * service named in the path. The doctor comes from that service, never from the request.
 */
@ApiTags('console-chats')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/workspaces/:unitId/chats')
export class ConsoleChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly workspaces: WorkspacesService,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
  ) {}

  private async viewer(accountId: string, unitId: string) {
    const unit = await this.workspaces.open(accountId, unitId);
    if (unit.kind !== 'clinic') throw AppException.notFound('This service has no messages');
    requirePermission(unit, 'messages');
    if (unit.status !== 'verified') {
      throw AppException.forbidden('Messages open once Doqto approves your application');
    }
    const doctor = await this.doctors
      .findOne({ unitId: new Types.ObjectId(unitId) }, { _id: 1 })
      .lean()
      .exec();
    if (!doctor) throw AppException.notFound('Your listing is not ready yet');
    return { side: 'doctor', doctorId: doctor._id } as const;
  }

  @Get()
  async list(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
  ): Promise<ChatThreadsResponse> {
    return this.chat.list(await this.viewer(user.id, unitId));
  }

  @Get(':appointmentId')
  async open(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('appointmentId') appointmentId: string,
    @Query() q: ChatAfterQueryDto,
  ): Promise<ChatMessagesResponse> {
    return this.chat.open(await this.viewer(user.id, unitId), appointmentId, q.after);
  }

  @Post(':appointmentId')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(SEND_LIMIT)
  async send(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: SendChatMessageDto,
  ): Promise<ChatMessage> {
    return this.chat.send(await this.viewer(user.id, unitId), appointmentId, body);
  }
}
