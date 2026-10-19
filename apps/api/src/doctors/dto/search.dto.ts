import {
  PAGE_LIMIT_DEFAULT,
  NEAR_MESSAGE,
  PAGE_LIMIT_MAX,
  parseNear,
  SPECIALTY_KEYS,
  type SpecialtyKey,
} from '@doqto/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsString, Length, Max, Min, ValidateBy } from 'class-validator';
import { Optional } from '../../common/http/optional';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors `DoctorSearchQuerySchema`; "city or near" is checked in the controller. */
export class DoctorSearchQueryDto {
  @ApiPropertyOptional({ example: 'Bareilly' })
  @Optional()
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  city?: string;
  @ApiPropertyOptional({ enum: SPECIALTY_KEYS })
  @Optional()
  @IsIn(SPECIALTY_KEYS)
  specialty?: SpecialtyKey;
  @ApiPropertyOptional({ example: '28.367,79.432', description: 'lat,lng' })
  @Optional()
  @ValidateBy({
    name: 'isIndiaLatLng',
    validator: {
      validate: (v) => typeof v === 'string' && parseNear(v) !== null,
      defaultMessage: () => NEAR_MESSAGE,
    },
  })
  near?: string;
  @ApiPropertyOptional({ default: 25 })
  @Optional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm: number = 25;
  @ApiPropertyOptional() @Optional() @Transform(trim) @IsString() @Length(2, 60) q?: string;
  @ApiPropertyOptional() @Optional() @IsString() @Length(1, 512) cursor?: string;
  @ApiPropertyOptional({ default: PAGE_LIMIT_DEFAULT })
  @Optional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit: number = PAGE_LIMIT_DEFAULT;
}
