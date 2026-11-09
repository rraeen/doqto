import { type PaymentResult } from '@doqto/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { DemoPayDto, VerifyPaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Demo mode: pays the held booking through the same path as a signed gateway webhook. */
  @Post('demo-pay')
  @HttpCode(200)
  @ApiOkResponse({ description: 'PaymentResult' })
  demoPay(@CurrentUser() user: AuthUser, @Body() body: DemoPayDto): Promise<PaymentResult> {
    return this.payments.demoPay(user.id, body.appointmentId);
  }

  /** Razorpay Checkout success: verifies the signature, then confirms once. */
  @Post('verify')
  @HttpCode(200)
  @ApiOkResponse({ description: 'PaymentResult' })
  verify(@CurrentUser() user: AuthUser, @Body() body: VerifyPaymentDto): Promise<PaymentResult> {
    return this.payments.verify(user.id, body);
  }
}
