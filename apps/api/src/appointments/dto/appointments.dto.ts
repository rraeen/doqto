import {
  CANCEL_REASONS,
  IST_DATE_REGEX,
  OBJECT_ID_REGEX,
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  PATIENT_NAME_MAX,
  PATIENT_NAME_MIN,
  PHONE_E164_IN_REGEX,
  PHONE_FORMAT_MESSAGE,
  VISIT_REASONS,
  type CancelReason,
  type VisitReason,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Optional } from '../../common/http/optional';

// Mirror packages/shared appointments.ts (checked by appointments-dto-parity.spec.ts).

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ObjectId = () => Matches(OBJECT_ID_REGEX, { message: 'Expected a 24-character hex id' });

export class SlotsQueryDto {
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiProperty({ description: 'IST YYYY-MM-DD' })
  @Matches(IST_DATE_REGEX, { message: 'Expected YYYY-MM-DD' })
  date!: string;
}

export class CreateAppointmentDto {
  @ApiProperty() @ObjectId() doctorId!: string;
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiProperty({ description: 'The slot start, exactly as returned by the slots route' })
  @IsISO8601({ strict: true })
  slotStart!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(PATIENT_NAME_MIN, PATIENT_NAME_MAX)
  patientName!: string;
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  patientPhone!: string;
  @ApiPropertyOptional({ enum: VISIT_REASONS })
  @Optional()
  @IsIn(VISIT_REASONS)
  reason?: VisitReason;
}

export class MyAppointmentsQueryDto {
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
  @ApiPropertyOptional({ enum: ['upcoming', 'past'] })
  @Optional()
  @IsIn(['upcoming', 'past'])
  tab?: 'upcoming' | 'past';
}

export class CancelAppointmentDto {
  @ApiPropertyOptional({ enum: CANCEL_REASONS })
  @Optional()
  @IsIn(CANCEL_REASONS)
  reason?: CancelReason;
}

export class RescheduleAppointmentDto {
  @ApiProperty() @IsISO8601({ strict: true }) slotStart!: string;
}
