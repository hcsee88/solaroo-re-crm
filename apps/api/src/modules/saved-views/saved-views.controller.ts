import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserContext } from '@solaroo/types';
import { SavedViewsService, SavedView } from './saved-views.service';
import {
  SavedViewQuerySchema,
  CreateSavedViewSchema,
  type SavedViewQueryDto,
  type CreateSavedViewDto,
} from './saved-views.dto';

/** Per-user filter persistence. No @RequirePermission — these are personal. */
@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly service: SavedViewsService) {}

  // GET /api/saved-views?module=contracts
  @Get()
  findAll(
    @Query(new ZodValidationPipe(SavedViewQuerySchema)) query: SavedViewQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<SavedView[]> {
    return this.service.findAll(query, user);
  }

  // POST /api/saved-views
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateSavedViewSchema)) dto: CreateSavedViewDto,
    @CurrentUser() user: UserContext,
  ): Promise<SavedView> {
    return this.service.create(dto, user);
  }

  // DELETE /api/saved-views/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.service.delete(id, user);
  }
}
