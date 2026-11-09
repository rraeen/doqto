import { DELETE_CONFIRM_WORD } from '@doqto/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsString, IsUrl, Length, MaxLength, ValidateNested } from 'class-validator';

// Mirror packages/shared account.ts (checked by account-dto-parity.spec.ts).

class PushKeysDto {
  @ApiProperty() @IsString() @Length(1, 256) p256dh!: string;
  @ApiProperty() @IsString() @Length(1, 256) auth!: string;
}

export class PushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['https', 'http'] })
  @MaxLength(2048)
  endpoint!: string;
  @ApiProperty() @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}

export class DeleteAccountDto {
  @ApiProperty({ enum: [DELETE_CONFIRM_WORD] }) @Equals(DELETE_CONFIRM_WORD) confirm!: 'DELETE';
}
