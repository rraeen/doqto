import type { StaffList, StaffMember } from '@doqto/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { ConsoleAuthGuard, CurrentConsoleUser, type ConsoleUser } from './console-auth.guard';
import { StaffService } from './staff.service';

/**
 * The owner's staff logins for one service. Owner only: a staff member gets a 403 on every route
 * here. Bodies are checked against the shared Zod schemas (`CreateStaffRequestSchema` and friends).
 */
@ApiTags('console-staff')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/workspaces/:unitId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentConsoleUser() user: ConsoleUser, @Param('unitId') unitId: string): Promise<StaffList> {
    return this.staff.list(user.id, unitId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: unknown,
  ): Promise<StaffMember> {
    return this.staff.create(user.id, unitId, body);
  }

  @Patch(':accountId')
  update(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('accountId') accountId: string,
    @Body() body: unknown,
  ): Promise<StaffMember> {
    return this.staff.update(user.id, unitId, accountId, body);
  }

  @Post(':accountId/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('accountId') accountId: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.staff.resetPassword(user.id, unitId, accountId, body);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('accountId') accountId: string,
  ): Promise<void> {
    return this.staff.remove(user.id, unitId, accountId);
  }
}
