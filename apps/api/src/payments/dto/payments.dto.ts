import { OBJECT_ID_REGEX } from '@doqto/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

// Mirror packages/shared appointments.ts (checked by payments-dto-parity.spec.ts).

export class DemoPayDto {
  @ApiProperty()
  @Matches(OBJECT_ID_REGEX, { message: 'Expected a 24-character hex id' })
  appointmentId!: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @Matches(OBJECT_ID_REGEX, { message: 'Expected a 24-character hex id' })
  appointmentId!: string;
  @ApiProperty() @IsString() @Length(1, 200) razorpayOrderId!: string;
  @ApiProperty() @IsString() @Length(1, 200) razorpayPaymentId!: string;
  @ApiProperty() @IsString() @Length(1, 500) razorpaySignature!: string;
}
