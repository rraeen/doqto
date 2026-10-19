import { type AppointmentPosition } from '@doqto/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { PositionService } from './position.service';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly positions: PositionService) {}

  /** Polled every 30 s by the patient's queue page. */
  @Get(':id/position')
  @ApiOkResponse({ description: 'AppointmentPosition' })
  position(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AppointmentPosition> {
    return this.positions.position(user.id, id);
  }
}
