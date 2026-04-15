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
import { UserContext } from '@solaroo/types';
import { AccountsService, AccountListItem, AccountDetail } from './accounts.service';
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  AccountQuerySchema,
} from './accounts.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '@solaroo/types';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermission('account', 'view')
  findAll(
    @Query(new ZodValidationPipe(AccountQuerySchema)) query: ReturnType<typeof AccountQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<AccountListItem>> {
    return this.accountsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('account', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<AccountDetail> {
    return this.accountsService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('account', 'create')
  create(
    @Body(new ZodValidationPipe(CreateAccountSchema)) dto: ReturnType<typeof CreateAccountSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<AccountDetail> {
    return this.accountsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('account', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAccountSchema)) dto: ReturnType<typeof UpdateAccountSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<AccountDetail> {
    return this.accountsService.update(id, dto, user);
  }
}
