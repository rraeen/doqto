import { type AdminNotification, type MyNotification, type Page } from '@doqto/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AdminNotificationsQueryDto, MyNotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class MyNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** FE-17 Demo inbox: "the message the patient would get". */
  @Get()
  @ApiOkResponse({ description: 'Page<MyNotification>' })
  @ApiNotFoundResponse({ description: 'Not in demo mode' })
  mine(
    @CurrentUser() user: AuthUser,
    @Query() q: MyNotificationsQueryDto,
  ): Promise<Page<MyNotification>> {
    return this.notifications.mine(user.id, q.cursor, q.limit);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** FE-18 failed notifications (any status filter). */
  @Get()
  @ApiOkResponse({ description: 'Page<AdminNotification>' })
  list(@Query() q: AdminNotificationsQueryDto): Promise<Page<AdminNotification>> {
    return this.notifications.adminList(q.status, q.cursor, q.limit);
  }
}
