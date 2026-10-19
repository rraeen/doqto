import {
  BOOKING_FEE_MAX,
  BOOKING_FEE_MIN,
  CONSULT_FEE_MAX,
  GENDERS,
  REGISTRATION_COUNCIL_MAX,
  SPECIALTY_KEYS,
  type DoctorOnboardingRequest,
  type Gender,
  type SpecialtyKey,
  type UpdateDoctorProfileRequest,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NullableOptional, Optional } from '../../common/http/optional';

// Mirror packages/shared doctors.ts (checked by doctor-dto-parity.spec.ts).

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class QualificationDto {
  @ApiProperty({ example: 'MBBS' }) @Transform(trim) @IsString() @Length(1, 80) degree!: string;
  @ApiPropertyOptional()
  @Optional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  institute?: string;
  @ApiPropertyOptional() @Optional() @IsInt() @Min(1950) @Max(2100) year?: number;
}

export class RegistrationDto {
  @ApiProperty({ example: 'Uttar Pradesh Medical Council' })
  @Transform(trim)
  @IsString()
  @Length(2, REGISTRATION_COUNCIL_MAX)
  council!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 40) number!: string;
  @ApiProperty() @IsInt() @Min(1950) @Max(2100) year!: number;
}

export class DoctorOnboardingDto implements DoctorOnboardingRequest {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 80) name!: string;
  @ApiPropertyOptional({ enum: GENDERS }) @Optional() @IsIn(GENDERS) gender?: Gender;
  @ApiPropertyOptional({ type: [String] })
  @Optional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(2, 30, { each: true })
  languages?: string[];
  @ApiProperty({ type: [QualificationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QualificationDto)
  qualifications!: QualificationDto[];
  @ApiProperty({ enum: SPECIALTY_KEYS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(SPECIALTY_KEYS, { each: true })
  specialties!: SpecialtyKey[];
  @ApiPropertyOptional() @Optional() @IsInt() @Min(0) @Max(70) experienceYears?: number;
  @ApiProperty({ type: RegistrationDto })
  @ValidateNested()
  @Type(() => RegistrationDto)
  registration!: RegistrationDto;
}

export class UpdateDoctorProfileDto implements UpdateDoctorProfileRequest {
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ enum: GENDERS, nullable: true })
  @NullableOptional()
  @IsIn(GENDERS)
  gender?: Gender | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  bio?: string | null;
  @ApiPropertyOptional({ type: [String] })
  @Optional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(2, 30, { each: true })
  languages?: string[];
  @ApiPropertyOptional({ type: [QualificationDto] })
  @Optional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QualificationDto)
  qualifications?: QualificationDto[];
  @ApiPropertyOptional({ enum: SPECIALTY_KEYS, isArray: true })
  @Optional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(SPECIALTY_KEYS, { each: true })
  specialties?: SpecialtyKey[];
  @ApiPropertyOptional({ nullable: true })
  @NullableOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Paise' })
  @NullableOptional()
  @IsInt()
  @Min(0)
  @Max(CONSULT_FEE_MAX)
  consultFee?: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: `Paise, ${BOOKING_FEE_MIN} to ${BOOKING_FEE_MAX}`,
  })
  @NullableOptional()
  @IsInt()
  @Min(BOOKING_FEE_MIN)
  @Max(BOOKING_FEE_MAX)
  bookingFee?: number | null;
  @ApiPropertyOptional({ type: RegistrationDto })
  @Optional()
  @ValidateNested()
  @Type(() => RegistrationDto)
  registration?: RegistrationDto;
}
