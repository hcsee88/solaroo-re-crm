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
  AuditQuerySchema,
  type UserQueryDto,
  type CreateUserDto,
  type UpdateUserDto,
  type ResetPasswordDto,
  type AuditQueryDto,
} from './admin.dto';
import type { PaginatedResult } from '@solaroo/types';
import { AuditService, type AuditLogItem } from '../../common/audit/audit.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly audit: AuditService,
  ) {}

  // GET /api/admin/audit — query the AuditLog (system-wide or per-resource).
  // Permission: audit_log:view (granted to SUPER_ADMIN, DIRECTOR, PMO_MANAGER).
  @Get('audit')
  @RequirePermission('audit_log', 'view')
  listAudit(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditLogItem>> {
    return this.audit.findAll(query);
  }

  // GET /api/admin/users/dropdown
  // No permission gate — any authenticated user can fetch users for select widgets.
  // Returns id, name, email, roleName only. Active users only.
  @Get('users/dropdown')
  listUsersDropdown(): Promise<{ id: string; name: string; email: string; roleName: string }[]> {
    return this.adminService.listUsersForDropdown();
  }

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
