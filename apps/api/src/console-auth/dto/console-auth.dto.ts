import {
  ACCOUNT_CODE_LENGTH,
  IDENTIFIER_MESSAGE,
  IDENTIFIER_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MESSAGE,
  PASSWORD_MIN_LENGTH,
  type ConsoleIdentifierRequest,
  type ConsoleLoginRequest,
  type ConsoleRegisterRequest,
  type ConsoleResetPasswordRequest,
  type ConsoleVerifyRequest,
} from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { Optional } from '../../common/http/optional';

// Request DTOs mirror the Zod schemas in packages/shared/src/console-auth.ts.

const identifier = () =>
  Matches(new RegExp(`^(?:${IDENTIFIER_REGEX.source})$`), { message: IDENTIFIER_MESSAGE });
const password = () => (target: object, key: string) => {
  MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_MESSAGE })(target, key);
  MaxLength(PASSWORD_MAX_LENGTH)(target, key);
  Matches(/[A-Za-z]/, { message: PASSWORD_MESSAGE })(target, key);
  Matches(/\d/, { message: PASSWORD_MESSAGE })(target, key);
};
const code = () =>
  Matches(new RegExp(`^\\d{${ACCOUNT_CODE_LENGTH}}$`), { message: 'Expected a 6-digit code' });

export class ConsoleRegisterDto implements ConsoleRegisterRequest {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 'dr.rao@example.com', description: 'Email, or Indian mobile in E.164' })
  @identifier()
  identifier!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @password()
  password!: string;

  @ApiPropertyOptional({ enum: ['en', 'hi'] })
  @Optional()
  @IsIn(['en', 'hi'])
  language?: 'en' | 'hi';
}

export class ConsoleVerifyDto implements ConsoleVerifyRequest {
  @ApiProperty() @identifier() identifier!: string;
  @ApiProperty({ example: '123456' }) @code() code!: string;
}

export class ConsoleIdentifierDto implements ConsoleIdentifierRequest {
  @ApiProperty() @identifier() identifier!: string;
}

export class ConsoleLoginDto implements ConsoleLoginRequest {
  @ApiProperty() @identifier() identifier!: string;

  @ApiProperty()
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;
}

export class ConsoleResetPasswordDto implements ConsoleResetPasswordRequest {
  @ApiProperty() @identifier() identifier!: string;
  @ApiProperty({ example: '123456' }) @code() code!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @password()
  newPassword!: string;
}
