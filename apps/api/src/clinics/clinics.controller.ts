import { PHOTO_MAX_BYTES, type ClinicPrivate } from '@doqto/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { requireFile, SingleFile, type UploadedBlob } from '../common/http/upload';
import { ClinicScopeGuard, type ClinicScopedRequest } from './clinic-scope.guard';
import { ClinicsService } from './clinics.service';
import { AddStaffDto, CreateClinicDto, UpdateClinicDto } from './dto/clinic.dto';

const fileBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
};

@ApiTags('clinics')
@ApiBearerAuth()
@ApiCookieAuth('doqto_at')
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}

  /** Doctors only (resolved from the doctor profile, so it works right after onboarding). */
  @Post()
  @ApiCreatedResponse({ description: 'ClinicPrivate' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateClinicDto): Promise<ClinicPrivate> {
    return this.clinics.create(user.id, body);
  }

  @Get('mine')
  @ApiOkResponse({ description: '{ items: ClinicPrivate[] }' })
  mine(@CurrentUser() user: AuthUser): Promise<{ items: ClinicPrivate[] }> {
    return this.clinics.mine(user.id);
  }

  @Get(':id')
  @UseGuards(ClinicScopeGuard)
  @ApiOkResponse({ description: 'ClinicPrivate' })
  get(@Req() req: ClinicScopedRequest): Promise<ClinicPrivate> {
    return this.clinics.toPrivate(req.clinic!, req.clinicAccess!);
  }

  @Patch(':id')
  @UseGuards(ClinicScopeGuard)
  @ApiOkResponse({ description: 'ClinicPrivate' })
  update(@Req() req: ClinicScopedRequest, @Body() body: UpdateClinicDto): Promise<ClinicPrivate> {
    this.clinics.assertManage(req.clinicAccess);
    return this.clinics.update(req.clinic!, body);
  }

  @Post(':id/photos')
  @UseGuards(ClinicScopeGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(SingleFile(PHOTO_MAX_BYTES))
  @ApiCreatedResponse({ description: 'ClinicPrivate' })
  addPhoto(
    @Req() req: ClinicScopedRequest,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<ClinicPrivate> {
    this.clinics.assertManage(req.clinicAccess);
    return this.clinics.addPhoto(req.clinic!, requireFile(file));
  }

  @Delete(':id/photos/:index')
  @UseGuards(ClinicScopeGuard)
  @ApiOkResponse({ description: 'ClinicPrivate' })
  removePhoto(
    @Req() req: ClinicScopedRequest,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<ClinicPrivate> {
    this.clinics.assertManage(req.clinicAccess);
    return this.clinics.removePhoto(req.clinic!, index);
  }

  @Post(':id/staff')
  @UseGuards(ClinicScopeGuard)
  @ApiCreatedResponse({ description: 'ClinicPrivate' })
  addStaff(
    @Req() req: ClinicScopedRequest,
    @CurrentUser() user: AuthUser,
    @Body() body: AddStaffDto,
  ): Promise<ClinicPrivate> {
    this.clinics.assertManage(req.clinicAccess);
    return this.clinics.addStaff(req.clinic!, user.id, body);
  }

  @Delete(':id/staff/:userId')
  @UseGuards(ClinicScopeGuard)
  @ApiOkResponse({ description: 'ClinicPrivate' })
  removeStaff(
    @Req() req: ClinicScopedRequest,
    @Param('userId') userId: string,
  ): Promise<ClinicPrivate> {
    this.clinics.assertManage(req.clinicAccess);
    return this.clinics.removeStaff(req.clinic!, userId);
  }
}
