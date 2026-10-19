import {
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  VERIFICATION_STATUSES,
  type VerificationStatus,
  type VerifyDoctorRequest,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Optional } from '../../common/http/optional';

export class AdminDoctorQueueQueryDto {
  @ApiPropertyOptional({ enum: VERIFICATION_STATUSES, default: 'pending' })
  @Optional()
  @IsIn(VERIFICATION_STATUSES)
  status: VerificationStatus = 'pending';
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
}

/** "Notes required to reject" is checked in the service (cross-field). */
export class VerifyDoctorDto implements VerifyDoctorRequest {
  @ApiProperty({ enum: ['approve', 'reject'] }) @IsIn(['approve', 'reject']) decision!:
    'approve' | 'reject';
  @ApiProperty({ description: '`reviewToken` from the detail response' })
  @IsString()
  @Length(16, 128)
  reviewToken!: string;
  @ApiPropertyOptional({ maxLength: 500 })
  @Optional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
