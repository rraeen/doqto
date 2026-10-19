import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../auth/decorators';
import { ProviderInputError, SignatureVerificationError } from '../errors';
import { PAYMENT_WEBHOOKS } from '../tokens';
import type { PaymentWebhooks } from './payment-webhooks.service';

/**
 * POST /api/v1/webhooks/payments. Needs the raw body: the app is created with
 * `NestFactory.create(AppModule, { rawBody: true })`. Unsigned or tampered
 * calls get 401 and nothing is parsed.
 */
@ApiExcludeController()
@SkipThrottle()
// Anonymous by design (gateway callbacks / signed URLs), so exempt from the global JwtAuthGuard.
@Public()
@Controller('webhooks')
export class PaymentWebhooksController {
  constructor(@Inject(PAYMENT_WEBHOOKS) private readonly webhooks: PaymentWebhooks) {}

  @Post(['payments', 'razorpay'])
  @HttpCode(200)
  async payments(@Req() req: RawBodyRequest<Request>): Promise<{ ok: true }> {
    if (!req.rawBody) throw new BadRequestException('raw body unavailable');
    try {
      await this.webhooks.process({ headers: req.headers, rawBody: req.rawBody });
    } catch (err) {
      if (err instanceof SignatureVerificationError)
        throw new UnauthorizedException('invalid signature');
      if (err instanceof ProviderInputError || err instanceof SyntaxError) {
        throw new BadRequestException('malformed event');
      }
      throw err;
    }
    return { ok: true };
  }
}
