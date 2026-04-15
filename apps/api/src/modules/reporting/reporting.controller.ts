import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/authz/permission.guard';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { ReportingService, DashboardMetrics } from './reporting.service';

@Controller('reporting')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard')
  @RequirePermission('reporting', 'view')
  getDashboard(@CurrentUser() user: UserContext): Promise<DashboardMetrics> {
    return this.reportingService.getDashboardMetrics(user);
  }

  @Get('pmo')
  @RequirePermission('reporting', 'view')
  getPmo(@CurrentUser() user: UserContext) {
    return this.reportingService.getPmoMetrics(user);
  }
}
