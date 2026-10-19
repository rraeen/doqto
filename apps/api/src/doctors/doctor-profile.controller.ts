import {
  PHOTO_MAX_BYTES,
  REGISTRATION_DOC_MAX_BYTES,
  type DoctorPrivateProfile,
  type RegistrationDocumentResponse,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UploadedFile,
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
import { DoctorsService } from './doctors.service';
import { DoctorOnboardingDto, UpdateDoctorProfileDto } from './dto/doctor.dto';

const fileBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
};

/**
 * The logged-in doctor's own profile (BE-07). Every route resolves the doctor by the caller's user id,
 * so a doctor can only ever reach their own document. No `@Roles(doctor)`: the role lands in the
 * access token only at the next refresh, and a non-doctor simply gets 404.
 */
@ApiTags('doctor')
@ApiBearerAuth()
@ApiCookieAuth('doqto_at')
@Controller('doctor')
export class DoctorProfileController {
  constructor(private readonly doctors: DoctorsService) {}

  @Post('onboarding')
  @ApiCreatedResponse({ description: 'DoctorPrivateProfile (packages/shared)' })
  onboard(
    @CurrentUser() user: AuthUser,
    @Body() body: DoctorOnboardingDto,
  ): Promise<DoctorPrivateProfile> {
    return this.doctors.onboard(user.id, body);
  }

  @Get('profile')
  @ApiOkResponse({ description: 'DoctorPrivateProfile' })
  get(@CurrentUser() user: AuthUser): Promise<DoctorPrivateProfile> {
    return this.doctors.getOwn(user.id);
  }

  @Patch('profile')
  @ApiOkResponse({ description: 'DoctorPrivateProfile' })
  update(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateDoctorProfileDto,
  ): Promise<DoctorPrivateProfile> {
    return this.doctors.updateOwn(user.id, body);
  }

  @Put('registration-document')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(SingleFile(REGISTRATION_DOC_MAX_BYTES))
  @ApiOkResponse({ description: 'RegistrationDocumentResponse' })
  uploadRegistration(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<RegistrationDocumentResponse> {
    return this.doctors.uploadRegistrationDocument(user.id, requireFile(file));
  }

  @Put('photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(SingleFile(PHOTO_MAX_BYTES))
  @ApiOkResponse({ description: 'DoctorPrivateProfile' })
  uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<DoctorPrivateProfile> {
    return this.doctors.uploadPhoto(user.id, requireFile(file));
  }
}
