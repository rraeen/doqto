import {
  CHECK_IN_METHODS,
  DELAY_MINUTES_MAX,
  DOCTOR_STATES,
  IST_DATE_REGEX,
  MANUAL_SOURCES,
  OBJECT_ID_REGEX,
  PHONE_E164_IN_REGEX,
  PHONE_FORMAT_MESSAGE,
  STATUS_MESSAGE_MAX,
  type CheckInRequest,
  type DaySheetQuery,
  type DoctorState,
  type QueueMoveRequest,
  type QueueNextRequest,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NullableOptional, Optional } from '../../common/http/optional';

// Mirror packages/shared clinic-console.ts and status.ts (checked by clinic-console-dto-parity.spec.ts).
// Cross-field rules (walk-ins have no slot, running late needs a delay) run through Zod in the services.

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ObjectId = () => Matches(OBJECT_ID_REGEX, { message: 'Expected a 24-character hex id' });

export class DaySheetQueryDto implements DaySheetQuery {
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiPropertyOptional() @Optional() @ObjectId() doctorId?: string;
  @ApiPropertyOptional({ description: 'IST YYYY-MM-DD, default today' })
  @Optional()
  @Matches(IST_DATE_REGEX)
  date?: string;
}

export class CreateClinicAppointmentDto {
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiProperty() @ObjectId() doctorId!: string;
  @ApiProperty({ enum: MANUAL_SOURCES })
  @IsIn(MANUAL_SOURCES)
  source!: (typeof MANUAL_SOURCES)[number];
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) patientName!: string;
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  patientPhone!: string;
  @ApiPropertyOptional() @Optional() @Matches(IST_DATE_REGEX) date?: string;
  @ApiPropertyOptional({ description: 'A slot start on the schedule (manual bookings only)' })
  @Optional()
  @IsISO8601({ strict: true })
  slotStart?: string;
}

export class CheckInDto implements CheckInRequest {
  @ApiProperty() @ObjectId() appointmentId!: string;
  @ApiProperty({ enum: CHECK_IN_METHODS })
  @IsIn(CHECK_IN_METHODS)
  method!: CheckInRequest['method'];
  @ApiProperty({ example: '4821' })
  @Matches(/^\d{4,6}$/, { message: 'Expected the 4-digit visit code or 6-digit OTP' })
  code!: string;
}

export class QueueNextDto implements QueueNextRequest {
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiProperty() @ObjectId() doctorId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Who you believe is in consult (double-tap guard)',
  })
  @NullableOptional()
  @ObjectId()
  currentAppointmentId?: string | null;
}

export class QueueMoveDto implements QueueMoveRequest {
  @ApiProperty() @ObjectId() beforeAppointmentId!: string;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @MaxLength(80) reason?: string;
}

export class UpdateStatusDto {
  @ApiProperty() @ObjectId() clinicId!: string;
  @ApiProperty() @ObjectId() doctorId!: string;
  @ApiProperty({ enum: DOCTOR_STATES }) @IsIn(DOCTOR_STATES) state!: DoctorState;
  @ApiPropertyOptional() @Optional() @IsInt() @Min(0) @Max(DELAY_MINUTES_MAX) delayMinutes?: number;
  @ApiPropertyOptional() @Optional() @IsISO8601({ strict: true }) etaAt?: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(STATUS_MESSAGE_MAX)
  message?: string | null;
}
