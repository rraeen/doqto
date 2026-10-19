import {
  BOOKING_WINDOW_DAYS_MAX,
  SCHEDULE_BLOCKS_MAX,
  SCHEDULE_EXCEPTIONS_MAX,
  SLOT_MINUTES_MAX,
  SLOT_MINUTES_MIN,
  TIME_OF_DAY_REGEX,
  IST_DATE_REGEX,
  OBJECT_ID_REGEX,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Optional } from '../../common/http/optional';

// Mirror packages/shared schedules.ts (checked by schedule-dto-parity.spec.ts). Cross-field rules
// (end after start, no overlaps, one exception per date) run through the Zod schema in the service.

export class TimeBlockDto {
  @ApiProperty({ example: '10:00' }) @Matches(TIME_OF_DAY_REGEX) start!: string;
  @ApiProperty({ example: '13:00' }) @Matches(TIME_OF_DAY_REGEX) end!: string;
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(SLOT_MINUTES_MIN)
  @Max(SLOT_MINUTES_MAX)
  slotMinutes!: number;
}

export class WeeklyBlockDto extends TimeBlockDto {
  @ApiProperty({ description: '0 is Sunday' }) @IsInt() @Min(0) @Max(6) day!: number;
  @ApiPropertyOptional({ default: 1 }) @Optional() @Equals(1) capacityPerSlot?: 1;
}

export class ScheduleExceptionDto {
  @ApiProperty({ example: '2026-10-19' }) @Matches(IST_DATE_REGEX) date!: string;
  @ApiProperty({ enum: ['leave', 'custom'] }) @IsIn(['leave', 'custom']) type!: 'leave' | 'custom';
  @ApiPropertyOptional({
    type: [TimeBlockDto],
    description: 'Required for custom, absent for leave',
  })
  @ValidateIf((o: ScheduleExceptionDto) => o.type === 'custom' || o.blocks !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => TimeBlockDto)
  blocks?: TimeBlockDto[];
}

/** Shape only; `PutScheduleRequestSchema` (a discriminated union) is applied in the service. */
export class PutScheduleDto {
  @ApiProperty({ type: [WeeklyBlockDto] })
  @IsArray()
  @ArrayMaxSize(SCHEDULE_BLOCKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => WeeklyBlockDto)
  weekly!: WeeklyBlockDto[];
  @ApiPropertyOptional({ type: [ScheduleExceptionDto] })
  @Optional()
  @IsArray()
  @ArrayMaxSize(SCHEDULE_EXCEPTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionDto)
  exceptions?: ScheduleExceptionDto[];
  @ApiPropertyOptional({ default: 7 })
  @Optional()
  @IsInt()
  @Min(1)
  @Max(BOOKING_WINDOW_DAYS_MAX)
  bookingWindowDays?: number;
  @ApiPropertyOptional({ default: 0.3 })
  @Optional()
  @IsNumber()
  @Min(0)
  @Max(1)
  walkInShare?: number;
  @ApiPropertyOptional({ default: true }) @Optional() @IsBoolean() isActive?: boolean;
}

export class ScheduleQueryDto {
  @ApiPropertyOptional({
    description: 'Required for clinic staff; defaults to your own doctor profile',
  })
  @Optional()
  @Matches(OBJECT_ID_REGEX)
  doctorId?: string;
}
