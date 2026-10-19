import { type Me } from '@doqto/shared';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { MeDto, UpdateMeDto } from './dto/me.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@ApiCookieAuth('doqto_at')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: MeDto })
  get(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.getMe(user.id);
  }

  @Patch()
  @ApiOkResponse({ type: MeDto })
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto): Promise<Me> {
    return this.users.updateMe(user.id, body);
  }
}
