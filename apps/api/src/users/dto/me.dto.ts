import {
  LANGUAGES,
  ROLES,
  USER_STATUSES,
  type Language,
  type Me,
  type Role,
  type UpdateMeRequest,
  type UserStatus,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsString, Length } from 'class-validator';
import { Optional } from '../../common/http/optional';

export class MeDto implements Me {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '+919876543210' }) phone!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ enum: ROLES, isArray: true }) roles!: Role[];
  @ApiProperty({ enum: LANGUAGES }) language!: Language;
  @ApiProperty() whatsappOptIn!: boolean;
  @ApiProperty({ enum: USER_STATUSES }) status!: UserStatus;
  @ApiProperty({ type: [String] }) clinicIds!: string[];
  @ApiProperty() isDemo!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class UpdateMeDto implements UpdateMeRequest {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @Optional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @Optional()
  @IsIn(LANGUAGES)
  language?: Language;

  @ApiPropertyOptional()
  @Optional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
