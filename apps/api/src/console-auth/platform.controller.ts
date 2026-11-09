import {
  PROFILE_CHANGE_DECISIONS,
  type ProfileChangeDetail,
  type ProfileChangeList,
  APPLICATION_DECISIONS,
  UNIT_STATUSES,
  WORKSPACE_TYPES,
  type ApplicationDetail,
  type ApplicationList,
  type UnitStatus,
  type WorkspaceType,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { Public } from '../auth/decorators';
import { Optional } from '../common/http/optional';
import { PlatformApplicationsService } from './platform-applications.service';
import { PlatformProfileChangesService } from './platform-profile-changes.service';
import { CurrentPlatformUser, PlatformAuthGuard, type PlatformUser } from './platform-auth.guard';
import { AppException } from '../common/http/app-exception';

export class ApplicationsQueryDto {
  @ApiPropertyOptional({ enum: UNIT_STATUSES })
  @Optional()
  @IsIn(UNIT_STATUSES)
  status?: UnitStatus;

  @ApiPropertyOptional({ enum: WORKSPACE_TYPES })
  @Optional()
  @IsIn(WORKSPACE_TYPES)
  kind?: WorkspaceType;
}

export class ApplicationDecisionDto {
  @ApiProperty({ enum: APPLICATION_DECISIONS })
  @IsIn(APPLICATION_DECISIONS)
  decision!: (typeof APPLICATION_DECISIONS)[number];

  @ApiPropertyOptional({ description: 'Required (5+ characters) unless approving' })
  @Optional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** The Doqto team reviews applications from doctors, clinics, labs and pharmacies (admin role). */
@ApiTags('platform-applications')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/applications')
export class PlatformApplicationsController {
  constructor(private readonly applications: PlatformApplicationsService) {}

  @Get()
  list(@Query() query: ApplicationsQueryDto): Promise<ApplicationList> {
    return this.applications.list(query);
  }

  @Get(':id')
  one(@Param('id') id: string): Promise<ApplicationDetail> {
    return this.applications.detail(id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id') id: string,
    @Body() body: ApplicationDecisionDto,
  ): Promise<ApplicationDetail> {
    if (body.decision !== 'approve' && (body.note?.trim().length ?? 0) < 5) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Some fields are invalid',
        {
          issues: [{ path: 'note', message: 'Tell the applicant why (at least 5 characters)' }],
        },
      );
    }
    return this.applications.decide(user, id, { ...body, note: body.note?.trim() });
  }
}

export class ProfileChangeDecisionDto {
  @ApiProperty({ enum: PROFILE_CHANGE_DECISIONS })
  @IsIn(PROFILE_CHANGE_DECISIONS)
  decision!: (typeof PROFILE_CHANGE_DECISIONS)[number];

  @ApiPropertyOptional({ description: 'Required (5+ characters) when rejecting' })
  @Optional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** The Doqto team reviews changes doctors made to their profile (admin role). */
@ApiTags('platform-profile-changes')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/profile-changes')
export class PlatformProfileChangesController {
  constructor(private readonly changes: PlatformProfileChangesService) {}

  @Get()
  list(): Promise<ProfileChangeList> {
    return this.changes.list();
  }

  @Get(':id')
  one(@Param('id') id: string): Promise<ProfileChangeDetail> {
    return this.changes.detail(id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id') id: string,
    @Body() body: ProfileChangeDecisionDto,
  ): Promise<ProfileChangeList> {
    if (body.decision === 'reject' && (body.note?.trim().length ?? 0) < 5) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Some fields are invalid',
        {
          issues: [{ path: 'note', message: 'Tell the doctor why (at least 5 characters)' }],
        },
      );
    }
    return this.changes.decide(user, id, { ...body, note: body.note?.trim() });
  }
}
