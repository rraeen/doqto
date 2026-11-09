import {
  RECORD_FILE_MAX_BYTES,
  type HealthRecord,
  type HealthRecordsPage,
  type RecordFileLink,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { requireFile, type UploadedBlob } from '../common/http/upload';
import { CreateRecordDto, RecordsQueryDto } from './dto/records.dto';
import { RecordsService } from './records.service';

const WRITE_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('records')
@ApiBearerAuth()
@Controller('me/records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  /** The patient's records, newest visit first, with search and filters. */
  @Get()
  @ApiOkResponse({ description: 'HealthRecordsPage' })
  list(@CurrentUser() user: AuthUser, @Query() q: RecordsQueryDto): Promise<HealthRecordsPage> {
    return this.records.list(user.id, q);
  }

  /** Multipart: the `file` (PDF, JPEG, PNG or WebP, up to 5 MB) and the text fields. */
  @Post()
  @Throttle(WRITE_LIMIT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: RECORD_FILE_MAX_BYTES, files: 1, fields: 12 } }),
  )
  @ApiCreatedResponse({ description: 'HealthRecord' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateRecordDto,
    @UploadedFile() file: UploadedBlob | undefined,
  ): Promise<HealthRecord> {
    return this.records.create(user.id, body, requireFile(file));
  }

  /** A short-lived link to download the file. */
  @Get(':id/file')
  @ApiOkResponse({ description: 'RecordFileLink' })
  file(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RecordFileLink> {
    return this.records.fileLink(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.records.remove(user.id, id);
  }
}
