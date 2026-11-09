import {
  IST_DATE_REGEX,
  OBJECT_ID_REGEX,
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  RECORD_KINDS,
  RECORD_NAME_MAX,
  RECORD_STATUSES,
  RECORD_TITLE_MAX,
  RECORD_TITLE_MIN,
  RECORD_VISIT_TYPES,
  type RecordKind,
  type RecordStatus,
  type RecordVisitType,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Optional } from '../../common/http/optional';

// Mirror packages/shared records.ts (checked by records-dto-parity.spec.ts).

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const KIND_LIST = new RegExp(`^(${RECORD_KINDS.join('|')})(,(${RECORD_KINDS.join('|')}))*$`);

/** The text fields that come with the uploaded `file` (multipart, so everything is a string). */
export class CreateRecordDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(RECORD_TITLE_MIN, RECORD_TITLE_MAX)
  title!: string;
  @ApiProperty({ enum: RECORD_KINDS }) @IsIn(RECORD_KINDS) kind!: RecordKind;
  @ApiProperty({ enum: RECORD_VISIT_TYPES }) @IsIn(RECORD_VISIT_TYPES) visitType!: RecordVisitType;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, RECORD_NAME_MAX) doctorName!: string;
  @ApiPropertyOptional()
  @Optional()
  @Transform(trim)
  @IsString()
  @MaxLength(RECORD_NAME_MAX)
  facility?: string;
  @ApiProperty({ description: 'IST YYYY-MM-DD' }) @Matches(IST_DATE_REGEX) date!: string;
  @ApiPropertyOptional({ enum: RECORD_STATUSES })
  @Optional()
  @IsIn(RECORD_STATUSES)
  status?: RecordStatus;
  @ApiPropertyOptional() @Optional() @Matches(OBJECT_ID_REGEX) appointmentId?: string;
}

export class RecordsQueryDto {
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @Length(1, 60) q?: string;
  @ApiPropertyOptional({ description: 'Comma separated kinds' })
  @Optional()
  @Matches(KIND_LIST)
  kind?: string;
  @ApiPropertyOptional({ enum: RECORD_VISIT_TYPES })
  @Optional()
  @IsIn(RECORD_VISIT_TYPES)
  visitType?: RecordVisitType;
  @ApiPropertyOptional()
  @Optional()
  @Transform(trim)
  @IsString()
  @Length(1, RECORD_NAME_MAX * 5)
  doctor?: string;
  @ApiPropertyOptional() @Optional() @Matches(IST_DATE_REGEX) from?: string;
  @ApiPropertyOptional() @Optional() @Matches(IST_DATE_REGEX) to?: string;
}
