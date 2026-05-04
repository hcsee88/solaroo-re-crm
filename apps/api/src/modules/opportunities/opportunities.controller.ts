import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { UserContext, PaginatedResult } from '@solaroo/types';
import {
  OpportunitiesService,
  OpportunityListItem,
  OpportunityDetail,
} from './opportunities.service';
import {
  CreateOpportunitySchema,
  UpdateOpportunitySchema,
  TransitionStageSchema,
  OpportunityQuerySchema,
  UpdateNextActionSchema,
} from './opportunities.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @RequirePermission('opportunity', 'view')
  findAll(
    @Query(new ZodValidationPipe(OpportunityQuerySchema)) query: ReturnType<typeof OpportunityQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<OpportunityListItem>> {
    return this.opportunitiesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('opportunity', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<OpportunityDetail> {
    return this.opportunitiesService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('opportunity', 'create')
  create(
    @Body(new ZodValidationPipe(CreateOpportunitySchema)) dto: ReturnType<typeof CreateOpportunitySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<OpportunityDetail> {
    return this.opportunitiesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('opportunity', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOpportunitySchema)) dto: ReturnType<typeof UpdateOpportunitySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<OpportunityDetail> {
    return this.opportunitiesService.update(id, dto, user);
  }

  // Stage transition — edit permission for most stages; WON requires approve (checked in service)
  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('opportunity', 'edit')
  transitionStage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionStageSchema)) dto: ReturnType<typeof TransitionStageSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<OpportunityDetail> {
    return this.opportunitiesService.transitionStage(id, dto, user);
  }

  // Dedicated next-action update — finer-grained than full opportunity edit
  @Patch(':id/next-action')
  @RequirePermission('opportunity', 'edit')
  updateNextAction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateNextActionSchema)) dto: ReturnType<typeof UpdateNextActionSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<OpportunityDetail> {
    return this.opportunitiesService.updateNextAction(id, dto, user);
  }
}
