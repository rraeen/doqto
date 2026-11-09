import {
  type AppointmentPosition,
  type CancelAppointmentResponse,
  type CreateAppointmentResponse,
  type MyAppointment,
  type Page,
  type RescheduleAppointmentResponse,
  type SlotsResponse,
} from '@doqto/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  MyAppointmentsQueryDto,
  RescheduleAppointmentDto,
  SlotsQueryDto,
} from './dto/appointments.dto';
import { BookingService } from './booking.service';
import { ChangeService } from './change.service';
import { PositionService } from './position.service';
import { SlotsService } from './slots.service';

/** Booking writes are limited per client: a double tap is harmless, a script is not. */
const BOOKING_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorSlotsController {
  constructor(private readonly slots: SlotsService) {}

  /** Free online slots of one doctor at one clinic on one day (short cache: others book too). */
  @Get(':id/slots')
  @ApiOkResponse({ description: 'SlotsResponse' })
  forDay(@Param('id') id: string, @Query() q: SlotsQueryDto): Promise<SlotsResponse> {
    return this.slots.forDay(id, q);
  }
}

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly positions: PositionService,
    private readonly booking: BookingService,
    private readonly change: ChangeService,
  ) {}

  /** Holds the slot for 10 minutes and returns the order to pay. */
  @Post()
  @Throttle(BOOKING_LIMIT)
  @ApiCreatedResponse({ description: 'CreateAppointmentResponse' })
  @ApiConflictResponse({ description: 'SLOT_TAKEN' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAppointmentDto,
  ): Promise<CreateAppointmentResponse> {
    return this.booking.create(user.id, body);
  }

  // Declared before `:id` so "mine" is not read as an id.
  @Get('mine')
  @ApiOkResponse({ description: 'Page<MyAppointment>' })
  mine(
    @CurrentUser() user: AuthUser,
    @Query() q: MyAppointmentsQueryDto,
  ): Promise<Page<MyAppointment>> {
    return this.booking.mine(user.id, q);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'MyAppointment' })
  byId(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<MyAppointment> {
    return this.booking.byId(user.id, id);
  }

  /** Cancels with the refund the rules allow (`refundForPatientCancel`). */
  @Post(':id/cancel')
  @HttpCode(200)
  @Throttle(BOOKING_LIMIT)
  @ApiOkResponse({ description: 'CancelAppointmentResponse' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelAppointmentDto,
  ): Promise<CancelAppointmentResponse> {
    return this.change.cancel(user.id, id, body);
  }

  /** Moves a paid booking to another free slot; the fee and visit code carry over. */
  @Post(':id/reschedule')
  @HttpCode(200)
  @Throttle(BOOKING_LIMIT)
  @ApiOkResponse({ description: 'RescheduleAppointmentResponse' })
  @ApiConflictResponse({ description: 'SLOT_TAKEN' })
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RescheduleAppointmentDto,
  ): Promise<RescheduleAppointmentResponse> {
    return this.change.reschedule(user.id, id, body);
  }

  /** Polled every 30 s by the patient's queue page. */
  @Get(':id/position')
  @ApiOkResponse({ description: 'AppointmentPosition' })
  position(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AppointmentPosition> {
    return this.positions.position(user.id, id);
  }
}
