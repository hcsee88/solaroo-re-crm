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
import { SitesService, SiteListItem, SiteDetail } from './sites.service';
import { CreateSiteSchema, UpdateSiteSchema, SiteQuerySchema } from './sites.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @RequirePermission('site', 'view')
  findAll(
    @Query(new ZodValidationPipe(SiteQuerySchema)) query: ReturnType<typeof SiteQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<SiteListItem>> {
    return this.sitesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('site', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<SiteDetail> {
    return this.sitesService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('site', 'create')
  create(
    @Body(new ZodValidationPipe(CreateSiteSchema)) dto: ReturnType<typeof CreateSiteSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<SiteDetail> {
    return this.sitesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('site', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSiteSchema)) dto: ReturnType<typeof UpdateSiteSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<SiteDetail> {
    return this.sitesService.update(id, dto, user);
  }
}
