import type {
  CodeSentResponse,
  ConsoleAccount,
  ConsoleRefreshResponse,
  ConsoleSession,
} from '@doqto/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators';
import { clientIp } from '../common/http/client-ip';
import { AppConfig } from '../config/app-config.service';
import { ConsoleAuthGuard, CurrentConsoleUser, type ConsoleUser } from './console-auth.guard';
import { ConsoleAuthService, ConsoleRefreshRacedException } from './console-auth.service';
import { clearConsoleCookies, presentedConsoleRefresh, setConsoleCookies } from './console-cookies';
import {
  ConsoleIdentifierDto,
  ConsoleLoginDto,
  ConsoleRegisterDto,
  ConsoleResetPasswordDto,
  ConsoleVerifyDto,
} from './dto/console-auth.dto';

const TEN_MINUTES = 10 * 60_000;

/**
 * Sign-in for doctors, clinics, labs and pharmacies. Tokens travel only in httpOnly cookies
 * (`doqto_ct`, `doqto_crt`), separate from the patient cookies. Routes are public to the global
 * patient guard; the ones that need a session use `ConsoleAuthGuard`.
 */
@ApiTags('console-auth')
@Public()
@Controller('console/auth')
export class ConsoleAuthController {
  constructor(
    private readonly auth: ConsoleAuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: TEN_MINUTES } })
  register(@Body() body: ConsoleRegisterDto, @Req() req: Request): Promise<CodeSentResponse> {
    return this.auth.register(body, clientIp(req, this.config));
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: TEN_MINUTES } })
  resend(@Body() body: ConsoleIdentifierDto, @Req() req: Request): Promise<CodeSentResponse> {
    return this.auth.resend(body.identifier, clientIp(req, this.config));
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: TEN_MINUTES } })
  async verify(
    @Body() body: ConsoleVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ConsoleSession> {
    const { account, tokens } = await this.auth.verify(body.identifier, body.code);
    setConsoleCookies(res, this.config, tokens);
    return {
      account,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: TEN_MINUTES } })
  async login(
    @Body() body: ConsoleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ConsoleSession> {
    const { account, tokens } = await this.auth.login(body, clientIp(req, this.config));
    setConsoleCookies(res, this.config, tokens);
    return {
      account,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: TEN_MINUTES } })
  forgotPassword(
    @Body() body: ConsoleIdentifierDto,
    @Req() req: Request,
  ): Promise<CodeSentResponse> {
    return this.auth.forgotPassword(body.identifier, clientIp(req, this.config));
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: TEN_MINUTES } })
  async resetPassword(
    @Body() body: ConsoleResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.resetPassword(body);
    clearConsoleCookies(res, this.config);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ConsoleRefreshResponse> {
    try {
      const tokens = await this.auth.refresh(presentedConsoleRefresh(req));
      setConsoleCookies(res, this.config, tokens);
      return {
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      };
    } catch (e) {
      // The losing tab of a parallel refresh must not clear the winner's fresh cookies.
      if (!(e instanceof ConsoleRefreshRacedException)) clearConsoleCookies(res, this.config);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(presentedConsoleRefresh(req));
    clearConsoleCookies(res, this.config);
  }

  @Get('me')
  @UseGuards(ConsoleAuthGuard)
  me(@CurrentConsoleUser() user: ConsoleUser): Promise<ConsoleAccount> {
    return this.auth.me(user.id);
  }
}
