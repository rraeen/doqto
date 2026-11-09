import {
  PHOTO_MAX_BYTES,
  WORKSPACE_TYPES,
  type MyProfile,
  type Schedule,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceType,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Public } from '../auth/decorators';
import { ConsoleAuthGuard, CurrentConsoleUser, type ConsoleUser } from './console-auth.guard';
import { PutScheduleDto } from '../schedules/dto/schedule.dto';
import { requireFile, SingleFile, type UploadedBlob } from '../common/http/upload';
import { UnitProfileService } from './unit-profile.service';
import { UnitScheduleService } from './unit-schedule.service';
import { WorkspacesService } from './workspaces.service';

export class ApplicationItemDto {
  @ApiProperty({ enum: WORKSPACE_TYPES })
  @IsIn(WORKSPACE_TYPES)
  kind!: WorkspaceType;

  @ApiProperty({
    description: 'The answers to the form of this service (packages/shared unit-forms)',
  })
  @IsObject()
  profile!: Record<string, unknown>;
}

export class SaveProfileDto {
  @ApiProperty({ description: 'The whole clinic form (packages/shared unit-forms)' })
  @IsObject()
  profile!: Record<string, unknown>;
}

export class ApplyDto {
  @ApiProperty({ type: [ApplicationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WORKSPACE_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => ApplicationItemDto)
  @ArrayUnique((a: ApplicationItemDto) => a.kind)
  applications!: ApplicationItemDto[];
}

/**
 * The services (clinic, lab, pharmacy) the signed-in account applied for and where each application
 * is. Public to the global patient guard; `ConsoleAuthGuard` requires a console session.
 */
@ApiTags('console-workspaces')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly schedule: UnitScheduleService,
    private readonly profile: UnitProfileService,
  ) {}

  @Get()
  list(@CurrentConsoleUser() user: ConsoleUser): Promise<Workspace[]> {
    return this.workspaces.list(user.id);
  }

  /** One service with its application form answers, only if the account is a member of it. */
  @Get(':id')
  one(@CurrentConsoleUser() user: ConsoleUser, @Param('id') id: string): Promise<WorkspaceDetail> {
    return this.workspaces.detail(user.id, id);
  }

  /** The doctor's own profile: what patients see now, and the change waiting for approval. */
  @Get(':id/profile')
  getProfile(@CurrentConsoleUser() user: ConsoleUser, @Param('id') id: string): Promise<MyProfile> {
    return this.profile.get(user.id, id);
  }

  /** Keeps the edited profile as a pending change; patients see it only once Doqto approves. */
  @Put(':id/profile')
  putProfile(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('id') id: string,
    @Body() body: SaveProfileDto,
  ): Promise<MyProfile> {
    return this.profile.save(user.id, id, body);
  }

  @Put(':id/profile/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(SingleFile(PHOTO_MAX_BYTES))
  putProfilePhoto(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<MyProfile> {
    return this.profile.uploadPhoto(user.id, id, requireFile(file));
  }

  @Delete(':id/profile')
  withdrawProfile(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('id') id: string,
  ): Promise<MyProfile> {
    return this.profile.withdraw(user.id, id);
  }

  /** The weekly hours patients can book in, for an approved clinic or doctor service. */
  @Get(':id/schedule')
  getSchedule(@CurrentConsoleUser() user: ConsoleUser, @Param('id') id: string): Promise<Schedule> {
    return this.schedule.get(user.id, id);
  }

  @Put(':id/schedule')
  putSchedule(
    @CurrentConsoleUser() user: ConsoleUser,
    @Param('id') id: string,
    @Body() body: PutScheduleDto,
  ): Promise<Schedule> {
    return this.schedule.put(user.id, id, body);
  }
}

/** Apply for one or more services, each with its form. */
@ApiTags('console-workspaces')
@Public()
@UseGuards(ConsoleAuthGuard)
@Controller('console/applications')
export class ApplicationsController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  apply(@CurrentConsoleUser() user: ConsoleUser, @Body() body: ApplyDto): Promise<Workspace[]> {
    return this.workspaces.apply(user.id, body.applications);
  }
}
