import {
  LAB_REPORT_MAX_BYTES,
  type LabBooking,
  type LabBookingList,
  type LabCatalogue,
  type LabCategory,
  type LabCollectors,
  type LabConsoleBooking,
  type LabConsoleBookingList,
  type LabList,
  type LabProfile,
  type LabReportLink,
  type LabTest,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public } from '../auth/decorators';
import { requireFile, SingleFile, type UploadedBlob } from '../common/http/upload';
import { ConsoleAuthGuard, CurrentConsoleUser, type ConsoleUser } from '../console-auth/console-auth.guard';
import { ConsoleLabService } from './console-lab.service';
import { LabsService } from './labs.service';

/** Labs on the patient site. Browsing is public; sending a request needs a patient sign-in. */
@ApiTags('labs')
@Controller('labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  @Public()
  @Get()
  list(@Query('city') city?: string, @Query('q') q?: string): Promise<LabList> {
    return this.labs.list(city, q);
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string): Promise<LabProfile> {
    return this.labs.profile(slug);
  }

  @ApiBearerAuth()
  @Post(':slug/bookings')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  book(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ): Promise<LabBooking> {
    return this.labs.create(user.id, slug, body);
  }
}

/** The signed-in patient's own lab bookings. */
@ApiTags('labs')
@ApiBearerAuth()
@Controller('me/lab-bookings')
export class MyLabBookingsController {
  constructor(private readonly labs: LabsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<LabBookingList> {
    return this.labs.mine(user.id);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LabBooking> {
    return this.labs.one(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LabBooking> {
    return this.labs.cancel(user.id, id);
  }

  @Get(':id/report')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LabReportLink> {
    return this.labs.reportLink(user.id, id);
  }
}

/**
 * The lab's own screens. The lab service is named in the path; the member needs the permission for
 * each action (`catalogue`, `bookings`, `collection`, `reports`), and the owner has them all.
 */
@ApiTags('console-lab')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/workspaces/:unitId/lab')
export class ConsoleLabController {
  constructor(private readonly lab: ConsoleLabService) {}

  @Get('catalogue')
  catalogue(@CurrentConsoleUser() u: ConsoleUser, @Param('unitId') unitId: string): Promise<LabCatalogue> {
    return this.lab.catalogue(u.id, unitId);
  }

  @Post('categories')
  createCategory(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: unknown,
  ): Promise<LabCategory> {
    return this.lab.createCategory(u.id, unitId, body);
  }

  @Post('tests')
  createTest(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Body() body: unknown,
  ): Promise<LabTest> {
    return this.lab.createTest(u.id, unitId, body);
  }

  @Patch('tests/:testId')
  updateTest(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('testId') testId: string,
    @Body() body: unknown,
  ): Promise<LabTest> {
    return this.lab.updateTest(u.id, unitId, testId, body);
  }

  @Get('bookings')
  bookings(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Query('status') status?: string,
  ): Promise<LabConsoleBookingList> {
    return this.lab.list(u.id, unitId, status);
  }

  @Get('collectors')
  collectors(@CurrentConsoleUser() u: ConsoleUser, @Param('unitId') unitId: string): Promise<LabCollectors> {
    return this.lab.collectors(u.id, unitId);
  }

  @Post('bookings/:bookingId/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: unknown,
  ): Promise<LabConsoleBooking> {
    return this.lab.decide(u.id, unitId, bookingId, body);
  }

  @Post('bookings/:bookingId/progress')
  @HttpCode(HttpStatus.OK)
  progress(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: unknown,
  ): Promise<LabConsoleBooking> {
    return this.lab.progress(u.id, unitId, bookingId, body);
  }

  @Put('bookings/:bookingId/assignee')
  assign(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: unknown,
  ): Promise<LabConsoleBooking> {
    return this.lab.assign(u.id, unitId, bookingId, body);
  }

  /** Multipart `file`: the report (PDF or an image, up to 5 MB). */
  @Put('bookings/:bookingId/report')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(SingleFile(LAB_REPORT_MAX_BYTES))
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  uploadReport(
    @CurrentConsoleUser() u: ConsoleUser,
    @Param('unitId') unitId: string,
    @Param('bookingId') bookingId: string,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<LabConsoleBooking> {
    return this.lab.uploadReport(u.id, unitId, bookingId, requireFile(file));
  }
}
