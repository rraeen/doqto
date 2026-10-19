import { type Schedule } from '@doqto/shared';
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { PutScheduleDto, ScheduleQueryDto } from './dto/schedule.dto';
import { SchedulesService } from './schedules.service';

/** BE-14. The doctor, or anyone on that clinic's team (owner, its doctors, its staff). */
@ApiTags('schedules')
@ApiBearerAuth()
@Controller('doctor/schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get(':clinicId')
  @ApiOkResponse({ description: 'Schedule (updatedAt null when never saved)' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('clinicId') clinicId: string,
    @Query() q: ScheduleQueryDto,
  ): Promise<Schedule> {
    return this.schedules.get(user.id, clinicId, q.doctorId);
  }

  @Put(':clinicId')
  @ApiOkResponse({ description: 'Schedule' })
  put(
    @CurrentUser() user: AuthUser,
    @Param('clinicId') clinicId: string,
    @Query() q: ScheduleQueryDto,
    @Body() body: PutScheduleDto,
  ): Promise<Schedule> {
    return this.schedules.put(user.id, clinicId, q.doctorId, body);
  }
}
