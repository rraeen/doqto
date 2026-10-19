import {
  PHONE_E164_IN_REGEX,
  PHONE_FORMAT_MESSAGE,
  type AddStaffRequest,
  type CreateClinicRequest,
  type UpdateClinicRequest,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NullableOptional, Optional } from '../../common/http/optional';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Mirror packages/shared clinics.ts (checked by clinic-dto-parity.spec.ts).

export class AddressDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) line1!: string;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @MaxLength(100) area?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) city!: string;
  @ApiPropertyOptional()
  @Optional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  district?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) state!: string;
  @ApiProperty({ example: '243001' })
  @Matches(/^[1-9]\d{5}$/, { message: 'Expected a 6-digit PIN code' })
  pincode!: string;
}

/** India bounds: catches swapped lat/lng from the map picker. */
export class LatLngDto {
  @ApiProperty({ example: 28.367 }) @IsNumber() @Min(6) @Max(38) lat!: number;
  @ApiProperty({ example: 79.432 }) @IsNumber() @Min(68) @Max(98) lng!: number;
}

export class CreateClinicDto implements CreateClinicRequest {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 120) name!: string;
  @ApiPropertyOptional()
  @Optional()
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  phone?: string;
  @ApiProperty({ type: AddressDto }) @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @ApiPropertyOptional({ type: LatLngDto })
  @Optional()
  @ValidateNested()
  @Type(() => LatLngDto)
  location?: LatLngDto;
}

export class UpdateClinicDto implements UpdateClinicRequest {
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableOptional()
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  phone?: string | null;
  @ApiPropertyOptional({ type: AddressDto })
  @Optional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
  @ApiPropertyOptional({ type: LatLngDto, nullable: true })
  @NullableOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  location?: LatLngDto | null;
}

export class AddStaffDto implements AddStaffRequest {
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  phone!: string;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @Length(1, 80) name?: string;
}

export class GeocodeQueryDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 80) city!: string;
  @ApiPropertyOptional()
  @Optional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  address?: string;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @MaxLength(80) state?: string;
  @ApiPropertyOptional() @Optional() @Matches(/^[1-9]\d{5}$/) pincode?: string;
}
