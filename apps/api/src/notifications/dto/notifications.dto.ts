import {
  NOTIFICATION_STATUSES,
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  type NotificationStatus,
} from '@doqto/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Optional } from '../../common/http/optional';

export class MyNotificationsQueryDto {
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
}

export class AdminNotificationsQueryDto extends MyNotificationsQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_STATUSES })
  @Optional()
  @IsIn(NOTIFICATION_STATUSES)
  status?: NotificationStatus;
}
