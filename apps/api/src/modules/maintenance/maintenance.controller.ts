import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<unknown> {
    return this.maintenanceService.findAll(user);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<unknown> {
    return this.maintenanceService.findById(id, user);
  }
}
