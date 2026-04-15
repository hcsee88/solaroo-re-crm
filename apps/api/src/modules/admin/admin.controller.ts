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
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService, UserListItem, UserDetail, RoleItem } from './admin.service';
import {
  UserQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  type UserQueryDto,
  type CreateUserDto,
  type UpdateUserDto,
  type ResetPasswordDto,
} from './admin.dto';
import type { PaginatedResult } from '@solaroo/types';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // GET /api/admin/users
  @Get('users')
  @RequirePermission('user_admin', 'view')
  listUsers(
    @Query(new ZodValidationPipe(UserQuerySchema)) query: UserQueryDto,
  ): Promise<PaginatedResult<UserListItem>> {
    return this.adminService.listUsers(query);
  }

  // GET /api/admin/users/:id
  @Get('users/:id')
  @RequirePermission('user_admin', 'view')
  getUserById(@Param('id') id: string): Promise<UserDetail> {
    return this.adminService.getUserById(id);
  }

  // POST /api/admin/users
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('user_admin', 'create')
  createUser(
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ): Promise<UserDetail> {
    return this.adminService.createUser(dto);
  }

  // PATCH /api/admin/users/:id
  @Patch('users/:id')
  @RequirePermission('user_admin', 'edit')
  updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ): Promise<UserDetail> {
    return this.adminService.updateUser(id, dto);
  }

  // POST /api/admin/users/:id/reset-password
  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user_admin', 'edit')
  resetPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ ok: boolean }> {
    return this.adminService.resetPassword(id, dto);
  }

  // GET /api/admin/roles
  @Get('roles')
  @RequirePermission('user_admin', 'view')
  listRoles(): Promise<RoleItem[]> {
    return this.adminService.listRoles();
  }
}
