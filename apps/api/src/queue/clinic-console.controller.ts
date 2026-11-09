import {
  UpdateStatusRequestSchema,
  type ConfirmAppointmentResponse,
  type DaySheetItem,
  type DaySheetResponse,
  type DoctorStatus,
  type QueueActionResponse,
  type SendVisitOtpResponse,
} from '@doqto/shared';
import { Types } from 'mongoose';
import {
  Body,
  Controller,
  Logger,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ConfirmationService } from '../appointments/confirmation.service';
import { ClinicAccessService } from '../clinics/clinic-access.service';
import { zodCheck } from '../common/http/zod-check';
import { SchedulesService } from '../schedules/schedules.service';
import { DoctorStatusService } from '../status/doctor-status.service';
import {
  CheckInDto,
  CreateClinicAppointmentDto,
  DaySheetQueryDto,
  QueueMoveDto,
  QueueNextDto,
  UpdateStatusDto,
} from './dto/clinic-console.dto';
import { FrontDeskService } from './front-desk.service';
import { QueueService } from './queue.service';
import { StatusAlertsService } from './status-alerts.service';

/**
 * Clinic console (BE-15 to BE-18). Every route is for the clinic team: the owner, its doctors and
 * its staff. Appointments of other clinics are 404.
 */
@ApiTags('clinic console')
@ApiBearerAuth()
@Controller('clinic')
export class ClinicConsoleController {
  private readonly logger = new Logger(ClinicConsoleController.name);

  constructor(
    private readonly desk: FrontDeskService,
    private readonly queue: QueueService,
    private readonly status: DoctorStatusService,
    private readonly schedules: SchedulesService,
    private readonly access: ClinicAccessService,
    private readonly alerts: StatusAlertsService,
    private readonly confirmation: ConfirmationService,
  ) {}

  /** Alerts never undo the action that triggered them; a failure is only logged. */
  private async alertQueue(r: QueueActionResponse): Promise<QueueActionResponse> {
    const { doctorId, clinicId, date } = r.status;
    if (clinicId) {
      await this.alerts
        .afterQueueChange(new Types.ObjectId(doctorId), new Types.ObjectId(clinicId), date)
        .catch((e: unknown) =>
          this.logger.warn(`Turn-near alert failed: ${e instanceof Error ? e.name : 'error'}`),
        );
    }
    return r;
  }

  @Get('appointments')
  @ApiOkResponse({ description: 'DaySheetResponse' })
  daySheet(@CurrentUser() user: AuthUser, @Query() q: DaySheetQueryDto): Promise<DaySheetResponse> {
    return this.desk.daySheet(user.id, q);
  }

  @Post('appointments')
  @ApiCreatedResponse({ description: 'DaySheetItem (confirmed, no fee)' })
  @ApiConflictResponse({ description: 'SLOT_TAKEN' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateClinicAppointmentDto,
  ): Promise<DaySheetItem> {
    return this.desk.create(user.id, body);
  }

  /** The doctor accepts a paid booking; this creates the visit code and tells the patient. */
  @Post('appointments/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'ConfirmAppointmentResponse' })
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ConfirmAppointmentResponse> {
    return this.confirmation.confirm(user.id, id);
  }

  @Post('queue/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'QueueActionResponse' })
  checkIn(@CurrentUser() user: AuthUser, @Body() body: CheckInDto): Promise<QueueActionResponse> {
    return this.queue.checkIn(user.id, body);
  }

  @Post('queue/next')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'QueueActionResponse' })
  async next(
    @CurrentUser() user: AuthUser,
    @Body() body: QueueNextDto,
  ): Promise<QueueActionResponse> {
    return this.alertQueue(await this.queue.next(user.id, body));
  }

  @Post('queue/:appointmentId/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'SendVisitOtpResponse' })
  sendOtp(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') id: string,
  ): Promise<SendVisitOtpResponse> {
    return this.queue.sendVisitOtp(user.id, id);
  }

  @Post('queue/:appointmentId/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'QueueActionResponse' })
  async noShow(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') id: string,
  ): Promise<QueueActionResponse> {
    return this.alertQueue(await this.queue.noShow(user.id, id));
  }

  @Post('queue/:appointmentId/move')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'QueueActionResponse' })
  async move(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') id: string,
    @Body() body: QueueMoveDto,
  ): Promise<QueueActionResponse> {
    return this.alertQueue(await this.queue.move(user.id, id, body));
  }

  @Put('status')
  @ApiOkResponse({ description: 'DoctorStatus' })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Body() raw: UpdateStatusDto,
  ): Promise<DoctorStatus> {
    const body = zodCheck(UpdateStatusRequestSchema, raw);
    const { clinic, doctor } = await this.access.require(user.id, body.clinicId, body.doctorId);
    const schedule = await this.schedules.forDoctorAtClinic(doctor._id, clinic._id);
    const updated = await this.status.update(user.id, doctor._id, clinic._id, body, schedule);
    // TDD 6.4: the alert rules run in the same request.
    await this.alerts
      .afterStatusChange(doctor._id, clinic._id, updated.date)
      .catch((e: unknown) =>
        this.logger.warn(`Status alerts failed: ${e instanceof Error ? e.name : 'error'}`),
      );
    return updated;
  }
}
