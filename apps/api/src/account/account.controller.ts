import {
  type MyDataExport,
  type PushSubscriptionResponse,
  type TransparencyResponse,
} from '@doqto/shared';
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public } from '../auth/decorators';
import { AccountService } from './account.service';
import { DeleteAccountDto, PushSubscriptionDto } from './dto/account.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Registers this device for Web Push. The same device twice is one device. */
  @Post('push-subscriptions')
  @ApiCreatedResponse({ description: 'PushSubscriptionResponse' })
  registerPush(
    @CurrentUser() user: AuthUser,
    @Body() body: PushSubscriptionDto,
  ): Promise<PushSubscriptionResponse> {
    return this.account.registerPush(user.id, body);
  }

  @Delete('push-subscriptions/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async removePush(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.account.removePush(user.id, id);
  }

  /** Everything Doqto holds about the patient, as one file. */
  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ description: 'MyDataExport' })
  export(@CurrentUser() user: AuthUser): Promise<MyDataExport> {
    return this.account.exportData(user.id);
  }

  /** Deletes the account for good. Send `{ "confirm": "DELETE" }`. */
  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Body() body: DeleteAccountDto): Promise<void> {
    await this.account.deleteAccount(user.id, body);
  }
}

@ApiTags('transparency')
@Controller('transparency')
export class TransparencyController {
  constructor(private readonly account: AccountService) {}

  /** Public monthly review numbers. Cached for 5 minutes. */
  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'TransparencyResponse' })
  get(): Promise<TransparencyResponse> {
    return this.account.transparency();
  }
}
