import {
  Controller,
  Get,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { NotificationsService, NotificationItem } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /api/notifications — list recent non-dismissed notifications for current user
  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<NotificationItem[]> {
    return this.notificationsService.findAll(user);
  }

  // GET /api/notifications/unread-count — badge count for the bell icon
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: UserContext): Promise<{ count: number }> {
    return this.notificationsService.getUnreadCount(user);
  }

  // PATCH /api/notifications/read-all — mark every UNREAD notification read
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: UserContext): Promise<void> {
    return this.notificationsService.markAllRead(user);
  }

  // PATCH /api/notifications/:id/read — mark a single notification read
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.notificationsService.markRead(id, user);
  }

  // PATCH /api/notifications/:id/dismiss — dismiss (hide) a notification
  @Patch(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.notificationsService.dismiss(id, user);
  }
}
