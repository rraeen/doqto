import type {
  ConfirmAppointmentResponse,
  DaySheetItem,
  DaySheetResponse,
  DoctorStatus,
  QueueActionResponse,
  SendVisitOtpResponse,
} from '@doqto/shared';
import { IST_DATE_REGEX } from '@doqto/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiPropertyOptional, ApiTags, OmitType } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { Public } from '../auth/decorators';
import { Optional } from '../common/http/optional';
import {
  ConsoleAuthGuard,
  CurrentConsoleUser,
  type ConsoleUser,
} from '../console-auth/console-auth.guard';
import { ConsoleClinicService } from './console-clinic.service';
import {
  CheckInDto,
  CreateClinicAppointmentDto,
  QueueMoveDto,
  QueueNextDto,
  UpdateStatusDto,
} from './dto/clinic-console.dto';

// The same checks as the clinic console, without the clinic and doctor ids: those come from the
// service named in the path, never from the browser.
export class ConsoleNextDto extends OmitType(QueueNextDto, ['clinicId', 'doctorId'] as const) {}
export class ConsoleStatusDto extends OmitType(UpdateStatusDto, [
  'clinicId',
  'doctorId',
] as const) {}
export class ConsoleEntryDto extends OmitType(CreateClinicAppointmentDto, [
  'clinicId',
  'doctorId',
] as const) {}

export class ConsoleDayQueryDto {
  @ApiPropertyOptional({ example: '2026-11-10', description: 'IST date; today when omitted' })
  @Optional()
  @Matches(IST_DATE_REGEX, { message: 'Expected YYYY-MM-DD' })
  date?: string;
}

/**
 * Bookings of an approved clinic or doctor, for the console. Public to the patient guard; needs a
 * console session and membership of the service named in the path.
 */
@ApiTags('console-clinic')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/workspaces/:unitId')
export class ConsoleClinicController {
  constructor(private readonly clinic: ConsoleClinicService) {}

  @Get('appointments')
  day(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Query() q: ConsoleDayQueryDto,
  ): Promise<DaySheetResponse> {
    return this.clinic.day(user.id, unitId, q.date);
  }

  @Get('appointments/waiting')
  waiting(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
  ): Promise<DaySheetItem[]> {
    return this.clinic.waiting(user.id, unitId);
  }

  @Get('appointments/upcoming')
  upcoming(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
  ): Promise<DaySheetItem[]> {
    return this.clinic.upcoming(user.id, unitId);
  }

  /** A walk-in, or a booking taken over the phone or WhatsApp. */
  @Post('appointments')
  addEntry(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: ConsoleEntryDto,
  ): Promise<DaySheetItem> {
    return this.clinic.addEntry(user.id, unitId, body);
  }

  @Post('queue/check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: CheckInDto,
  ): Promise<QueueActionResponse> {
    return this.clinic.checkIn(user.id, unitId, body);
  }

  @Post('queue/next')
  @HttpCode(HttpStatus.OK)
  next(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: ConsoleNextDto,
  ): Promise<QueueActionResponse> {
    return this.clinic.next(user.id, unitId, body.currentAppointmentId);
  }

  @Post('queue/:appointmentId/send-otp')
  @HttpCode(HttpStatus.OK)
  sendOtp(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('appointmentId') appointmentId: string,
  ): Promise<SendVisitOtpResponse> {
    return this.clinic.sendOtp(user.id, unitId, appointmentId);
  }

  @Post('queue/:appointmentId/no-show')
  @HttpCode(HttpStatus.OK)
  noShow(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('appointmentId') appointmentId: string,
  ): Promise<QueueActionResponse> {
    return this.clinic.noShow(user.id, unitId, appointmentId);
  }

  @Post('queue/:appointmentId/move')
  @HttpCode(HttpStatus.OK)
  move(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: QueueMoveDto,
  ): Promise<QueueActionResponse> {
    return this.clinic.move(user.id, unitId, appointmentId, body);
  }

  @Put('status')
  updateStatus(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: ConsoleStatusDto,
  ): Promise<DoctorStatus> {
    return this.clinic.updateStatus(user.id, unitId, { ...body });
  }

  /** Accepts a paid booking: creates the visit code and tells the patient. */
  @Post('appointments/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('id') id: string,
  ): Promise<ConfirmAppointmentResponse> {
    return this.clinic.confirm(user.id, unitId, id);
  }
}
