import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<unknown> {
    return this.notificationsService.findAll(user);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<unknown> {
    return this.notificationsService.findById(id, user);
  }
}
