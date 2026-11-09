import {
  type AdminNotification,
  type MyNotification,
  type Page,
  type UnreadCount,
} from '@doqto/shared';
import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AdminNotificationsQueryDto, MyNotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class MyNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** The patient's inbox: the messages sent to them, newest first. */
  @Get()
  @ApiOkResponse({ description: 'Page<MyNotification>' })
  mine(
    @CurrentUser() user: AuthUser,
    @Query() q: MyNotificationsQueryDto,
  ): Promise<Page<MyNotification>> {
    return this.notifications.mine(user.id, q.cursor, q.limit);
  }

  @Get('unread-count')
  @ApiOkResponse({ description: 'UnreadCount' })
  unread(@CurrentUser() user: AuthUser): Promise<UnreadCount> {
    return this.notifications.unreadCount(user.id);
  }

  /** Opening the inbox marks everything read. */
  @Post('read')
  @HttpCode(204)
  async markRead(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
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
