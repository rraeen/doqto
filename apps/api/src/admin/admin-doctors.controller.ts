import {
  type AdminDoctorDetail,
  type AdminDoctorQueueItem,
  type DoctorPrivateProfile,
  type Page,
} from '@doqto/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AdminDoctorsService } from './admin-doctors.service';
import { AdminDoctorQueueQueryDto, VerifyDoctorDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/doctors')
export class AdminDoctorsController {
  constructor(private readonly admin: AdminDoctorsService) {}

  @Get()
  @ApiOkResponse({ description: 'Page<AdminDoctorQueueItem>' })
  queue(@Query() q: AdminDoctorQueueQueryDto): Promise<Page<AdminDoctorQueueItem>> {
    return this.admin.queue(q.status, q.cursor, q.limit);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'AdminDoctorDetail (signed documentUrl, 5 minutes)' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AdminDoctorDetail> {
    return this.admin.detail(user.id, id);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'DoctorPrivateProfile' })
  @ApiConflictResponse({ description: 'Already decided, changed since reviewed, or no document' })
  verify(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: VerifyDoctorDto,
  ): Promise<DoctorPrivateProfile> {
    return this.admin.decide(user.id, id, body);
  }
}
