import {
  CLIENT_HEADER,
  MOBILE_CLIENT,
  type OtpRequestResponse,
  type OtpVerifyResponse,
  type TokenPair,
} from '@doqto/shared';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/app-config.service';
import { clientIp } from '../common/http/client-ip';
import { clearAuthCookies, presentedRefreshToken, setAuthCookies } from './auth-cookies';
import { AuthService, RefreshRacedException } from './auth.service';
import { Public } from './decorators';
import {
  OtpRequestDto,
  OtpRequestResponseDto,
  OtpVerifyDto,
  OtpVerifyResponseDto,
  RefreshDto,
  TokenPairDto,
} from './dto/auth.dto';

/** Web clients get tokens only as httpOnly cookies; native clients opt into body tokens. */
function forClient<T extends TokenPair>(req: Request, body: T): T {
  if (req.header(CLIENT_HEADER) === MOBILE_CLIENT) return body;
  const { accessToken: _a, refreshToken: _r, ...rest } = body;
  return rest as T;
}

const clientHeader = ApiHeader({
  name: CLIENT_HEADER,
  required: false,
  description: `Send "${MOBILE_CLIENT}" to receive accessToken and refreshToken in the body (native apps). Web relies on cookies.`,
});

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OtpRequestResponseDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiTooManyRequestsResponse({
    description: 'RATE_LIMITED: more than 3 requests in 10 minutes per phone or per IP',
  })
  request(@Body() body: OtpRequestDto, @Req() req: Request): Promise<OtpRequestResponse> {
    return this.auth.requestOtp(body.phone, clientIp(req, this.config));
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  // On top of the 5 attempts per code: caps guessing across many phones from one IP.
  @Throttle({ default: { limit: 20, ttl: 10 * 60_000 } })
  @ApiOkResponse({
    type: OtpVerifyResponseDto,
    description: 'Also sets httpOnly doqto_at and doqto_rt cookies',
  })
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED, OTP_INVALID (details.attemptsLeft), OTP_EXPIRED, OTP_LOCKED',
  })
  @clientHeader
  async verify(
    @Body() body: OtpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OtpVerifyResponse> {
    const result = await this.auth.verifyOtp(body);
    setAuthCookies(res, this.config, result);
    return forClient(req, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'REFRESH_INVALID' })
  @clientHeader
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    try {
      const pair = await this.auth.refresh(presentedRefreshToken(req, body.refreshToken));
      setAuthCookies(res, this.config, pair);
      return forClient(req, pair);
    } catch (e) {
      if (!(e instanceof RefreshRacedException)) clearAuthCookies(res, this.config);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(presentedRefreshToken(req, body.refreshToken));
    clearAuthCookies(res, this.config);
  }
}
