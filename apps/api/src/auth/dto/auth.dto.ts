import {
  OTP_CODE_REGEX,
  PHONE_E164_IN_REGEX,
  PHONE_FORMAT_MESSAGE,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerifyRequest,
  type OtpVerifyResponse,
  type RefreshRequest,
  type TokenPair,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, Length, Matches } from 'class-validator';
import { MeDto } from '../../users/dto/me.dto';
import { Optional } from '../../common/http/optional';

// Request DTOs mirror the Zod schemas in packages/shared (checked by contract-parity.spec.ts).

export class OtpRequestDto implements OtpRequest {
  @ApiProperty({ example: '+919876543210', description: 'E.164 Indian mobile' })
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({ enum: ['login'], default: 'login' })
  @Optional()
  @IsIn(['login'])
  purpose?: 'login';
}

export class OtpRequestResponseDto implements OtpRequestResponse {
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ enum: ['whatsapp', 'sms', 'demo'] }) channel!: OtpRequestResponse['channel'];
}

export class OtpVerifyDto implements OtpVerifyRequest {
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_E164_IN_REGEX, { message: PHONE_FORMAT_MESSAGE })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @Matches(OTP_CODE_REGEX, { message: 'Expected a 6-digit code' })
  code!: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @Optional()
  @IsString()
  @Length(1, 128)
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Signup WhatsApp consent; applied only when this login creates the account',
  })
  @Optional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}

export class RefreshDto implements RefreshRequest {
  @ApiPropertyOptional({ description: 'Mobile only; web sends {} and the doqto_rt cookie' })
  @Optional()
  @IsString()
  @Length(1, 512)
  refreshToken?: string;
}

export class TokenPairDto implements TokenPair {
  @ApiPropertyOptional({ description: 'Only with X-Doqto-Client: mobile' }) accessToken?: string;
  @ApiProperty({ format: 'date-time' }) accessTokenExpiresAt!: string;
  @ApiPropertyOptional({ description: 'Only with X-Doqto-Client: mobile' }) refreshToken?: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt!: string;
}

export class OtpVerifyResponseDto extends TokenPairDto implements OtpVerifyResponse {
  @ApiProperty({ type: MeDto }) user!: MeDto;
  @ApiProperty() isNewUser!: boolean;
}
