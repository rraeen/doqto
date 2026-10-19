import { type HealthResponse } from '@doqto/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { AppConfig } from '../config/app-config.service';

class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] }) status!: 'ok';
  @ApiProperty({ example: 'dev' }) version!: string;
  @ApiProperty({ enum: ['demo', 'live'] }) providerMode!: HealthResponse['providerMode'];
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly config: AppConfig) {}

  @Get()
  @SkipThrottle()
  @ApiOkResponse({ type: HealthResponseDto })
  get(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.get('APP_VERSION'),
      providerMode: this.config.get('PROVIDER_MODE'),
    };
  }
}
