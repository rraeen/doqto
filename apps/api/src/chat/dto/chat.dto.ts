import { CHAT_TEXT_MAX } from '@doqto/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ maxLength: CHAT_TEXT_MAX })
  @IsString()
  @MaxLength(CHAT_TEXT_MAX * 2)
  text: string;
}

export class ChatAfterQueryDto {
  @ApiPropertyOptional({ description: 'ISO time; only newer messages come back' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  after?: string;
}
