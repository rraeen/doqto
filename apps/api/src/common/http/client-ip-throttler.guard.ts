import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { clientIp } from './client-ip';

/**
 * The global throttler, keyed on the same client IP as the OTP limits (`CLIENT_IP_HEADER`, else
 * `req.ip` with TRUST_PROXY), so there is one IP rule everywhere (RD BE-04 should-fix 1).
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: AppConfig,
  ) {
    super(options, storage, reflector);
  }

  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIp(req as unknown as Request, this.config));
  }
}
