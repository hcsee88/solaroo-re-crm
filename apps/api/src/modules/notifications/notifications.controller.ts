import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotificationsService, NotificationItem } from './notifications.service';
import {
  NotificationListQuerySchema,
  NotificationListQueryDto,
} from './notifications.dto';

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

  // GET /api/notifications/paginated — paginated list (for the full /notifications page)
  @Get('paginated')
  findAllPaginated(
    @Query(new ZodValidationPipe(NotificationListQuerySchema))
    query: NotificationListQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<NotificationItem>> {
    return this.notificationsService.findAllPaginated(user, query);
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
