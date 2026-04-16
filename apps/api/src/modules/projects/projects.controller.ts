import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UserContext } from '@solaroo/types';
import { ProjectsService } from './projects.service';
import {
  ProjectQuerySchema,
  ProjectQueryDto,
  CreateProjectSchema,
  CreateProjectDto,
  UpdateProjectSchema,
  UpdateProjectDto,
  UpdateGateStatusSchema,
  UpdateGateStatusDto,
  UpdateDeliverableSchema,
  UpdateDeliverableDto,
} from './projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // GET /api/projects
  @Get()
  @RequirePermission('project', 'view')
  findAll(
    @Query(new ZodValidationPipe(ProjectQuerySchema)) query: ProjectQueryDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.findAll(query, user);
  }

  // GET /api/projects/:id
  @Get(':id')
  @RequirePermission('project', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.findById(id, user);
  }

  // POST /api/projects
  @Post()
  @RequirePermission('project', 'create')
  create(
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.create(dto, user);
  }

  // PATCH /api/projects/:id
  @Patch(':id')
  @RequirePermission('project', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  // PATCH /api/projects/:id/gates/:gateNo/status
  @Patch(':id/gates/:gateNo/status')
  @RequirePermission('project_gate', 'view')
  updateGateStatus(
    @Param('id') id: string,
    @Param('gateNo', ParseIntPipe) gateNo: number,
    @Body(new ZodValidationPipe(UpdateGateStatusSchema)) dto: UpdateGateStatusDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.updateGateStatus(id, gateNo, dto, user);
  }

  // PATCH /api/projects/:id/deliverables/:deliverableId
  @Patch(':id/deliverables/:deliverableId')
  @RequirePermission('project', 'view')
  updateDeliverable(
    @Param('id') id: string,
    @Param('deliverableId') deliverableId: string,
    @Body(new ZodValidationPipe(UpdateDeliverableSchema)) dto: UpdateDeliverableDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.projectsService.updateDeliverable(id, deliverableId, dto, user);
  }
}
