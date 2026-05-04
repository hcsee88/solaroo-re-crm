import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserContext, PaginatedResult } from '@solaroo/types';
import { ActivitiesService, ActivityItem } from './activities.service';
import {
  CreateActivitySchema,
  UpdateActivitySchema,
  ActivityQuerySchema,
  type CreateActivityDto,
  type UpdateActivityDto,
  type ActivityQueryDto,
} from './activities.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @RequirePermission('activity', 'view')
  findAll(
    @Query(new ZodValidationPipe(ActivityQuerySchema)) query: ActivityQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<ActivityItem>> {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('activity', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ActivityItem> {
    return this.service.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('activity', 'create')
  create(
    @Body(new ZodValidationPipe(CreateActivitySchema)) dto: CreateActivityDto,
    @CurrentUser() user: UserContext,
  ): Promise<ActivityItem> {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('activity', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateActivitySchema)) dto: UpdateActivityDto,
    @CurrentUser() user: UserContext,
  ): Promise<ActivityItem> {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('activity', 'edit')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.service.delete(id, user);
  }
}
