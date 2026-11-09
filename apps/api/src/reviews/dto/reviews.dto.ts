import {
  OBJECT_ID_REGEX,
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  REPORT_REASONS,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  REVIEW_WAIT_MAX_MINUTES,
  VISIT_REASONS,
  WOULD_RECOMMEND,
  type ReportReason,
  type VisitReason,
  type WouldRecommend,
} from '@doqto/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Optional } from '../../common/http/optional';

// Mirror packages/shared reviews.ts (checked by reviews-dto-parity.spec.ts).

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const Star = () => applyDecorators(IsInt(), Min(1), Max(5));

export class RatingsDto {
  @ApiProperty() @Star() waitTime!: number;
  @ApiProperty() @Star() explanation!: number;
  @ApiProperty() @Star() behaviour!: number;
  @ApiProperty() @Star() facilities!: number;
  @ApiProperty() @Star() valueForMoney!: number;
}

class ReviewBodyDto {
  @ApiProperty() @ValidateNested() @Type(() => RatingsDto) ratings!: RatingsDto;
  @ApiProperty({ enum: WOULD_RECOMMEND }) @IsIn(WOULD_RECOMMEND) wouldRecommend!: WouldRecommend;
  @ApiProperty({ enum: VISIT_REASONS }) @IsIn(VISIT_REASONS) reason!: VisitReason;
  @ApiPropertyOptional({ minLength: REVIEW_TEXT_MIN, maxLength: REVIEW_TEXT_MAX })
  @Optional()
  @Transform(trim)
  @IsString()
  @Length(REVIEW_TEXT_MIN, REVIEW_TEXT_MAX)
  text?: string;
  @ApiPropertyOptional()
  @Optional()
  @IsInt()
  @Min(0)
  @Max(REVIEW_WAIT_MAX_MINUTES)
  waitedMinutes?: number;
}

export class CreateReviewDto extends ReviewBodyDto {
  @ApiProperty()
  @Matches(OBJECT_ID_REGEX, { message: 'Expected a 24-character hex id' })
  appointmentId!: string;
}

export class UpdateReviewDto extends ReviewBodyDto {}

export class ReportReviewDto {
  @ApiProperty({ enum: REPORT_REASONS }) @IsIn(REPORT_REASONS) reason!: ReportReason;
}

export class DoctorReviewsQueryDto {
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
  @ApiPropertyOptional({ enum: ['recent'] }) @Optional() @IsIn(['recent']) sort?: 'recent';
}
