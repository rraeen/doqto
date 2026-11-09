import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../auth/decorators';
import { hmacSha256Hex, safeEqualHex } from '../crypto';
import { INTEGRATIONS_CONFIG } from '../tokens';
import type { IntegrationsConfig } from '../integrations.config';

/**
 * Meta WhatsApp Cloud API callbacks, at /api/v1/webhooks/whatsapp.
 *
 * GET is Meta's one-time URL check: it sends `hub.verify_token` (the string you typed in the
 * Meta dashboard, `WHATSAPP_VERIFY_TOKEN`) and `hub.challenge`, and expects the challenge back.
 * POST carries delivery statuses and inbound messages, signed with the app secret
 * (`WHATSAPP_WEBHOOK_SECRET`) in `X-Hub-Signature-256`. Unsigned calls get 401.
 * Events are accepted and logged; sending and status tracking land with the live sender (INT-20).
 */
@ApiExcludeController()
@SkipThrottle()
@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhooksController {
  private readonly log = new Logger(WhatsAppWebhooksController.name);

  constructor(@Inject(INTEGRATIONS_CONFIG) private readonly config: IntegrationsConfig) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = this.config.whatsapp.verifyToken;
    if (!expected) throw new ForbiddenException('WHATSAPP_VERIFY_TOKEN is not set');
    if (mode !== 'subscribe' || token !== expected || !challenge) {
      throw new ForbiddenException('verify token mismatch');
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  receive(@Req() req: RawBodyRequest<Request>): { ok: true } {
    const secret = this.config.whatsapp.webhookSecret;
    if (!secret) throw new ForbiddenException('WHATSAPP_WEBHOOK_SECRET is not set');
    if (!req.rawBody) throw new BadRequestException('raw body unavailable');
    const header = req.headers['x-hub-signature-256'];
    const given = typeof header === 'string' ? header.replace(/^sha256=/, '') : '';
    if (!safeEqualHex(given, hmacSha256Hex(secret, req.rawBody))) {
      throw new UnauthorizedException('invalid signature');
    }
    this.logEvents(req.rawBody);
    return { ok: true };
  }

  /** One log line per delivery status or inbound message, with Meta's reason when a send failed. */
  private logEvents(rawBody: Buffer): void {
    try {
      const body = JSON.parse(rawBody.toString('utf8')) as {
        entry?: {
          changes?: {
            value?: {
              statuses?: {
                id?: string;
                status?: string;
                errors?: { code?: number; title?: string; message?: string }[];
              }[];
              messages?: { id?: string; type?: string }[];
            };
          }[];
        }[];
      };
      let seen = 0;
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          for (const s of change.value?.statuses ?? []) {
            seen++;
            const e = s.errors?.[0];
            this.log.log(
              `whatsapp status ${s.status} for ${s.id?.slice(0, 16)}…${
                e ? ` error ${e.code}: ${e.title ?? e.message}` : ''
              }`,
            );
          }
          for (const m of change.value?.messages ?? []) {
            seen++;
            this.log.log(`whatsapp inbound ${m.type} message ${m.id?.slice(0, 16)}…`);
          }
        }
      }
      if (seen === 0) this.log.log(`whatsapp webhook received (${rawBody.length} bytes)`);
    } catch {
      this.log.log(`whatsapp webhook received (${rawBody.length} bytes, unreadable)`);
    }
  }
}
