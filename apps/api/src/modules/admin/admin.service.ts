import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@solaroo/db';
import type { PaginatedResult } from '@solaroo/types';
import type {
  UserQueryDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
} from './admin.dto';

// ─── Return shapes ────────────────────────────────────────────────────────────

export type UserListItem = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  role: { id: string; name: string; displayName: string };
};

export type UserDetail = UserListItem & {
  updatedAt: Date;
};

export type RoleItem = {
  id: string;
  name: string;
  displayName: string;
  _count: { users: number };
};

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true, displayName: true } },
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dropdown user list (no permission gate — any authenticated user) ─────────
  // Returns minimal user data (id, name, email, roleName) for select/autocomplete widgets.
  // Active users only, sorted by name.

  async listUsersForDropdown(): Promise<{ id: string; name: string; email: string; roleName: string }[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
    });
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, roleName: u.role.name }));
  }

  // ─── List users ─────────────────────────────────────────────────────────────

  async listUsers(query: UserQueryDto): Promise<PaginatedResult<UserListItem>> {
    const { search, roleId, isActive, page, pageSize } = query;

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { name:  { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(roleId   !== undefined && { roleId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: USER_SELECT,
      }),
    ]);

    return {
      items: items as UserListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Get single user ─────────────────────────────────────────────────────────

  async getUserById(id: string): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...USER_SELECT, updatedAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user as UserDetail;
  }

  // ─── Create user ─────────────────────────────────────────────────────────────

  async createUser(dto: CreateUserDto): Promise<UserDetail> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('A user with this email already exists');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email:    dto.email,
        name:     dto.name,
        passwordHash,
        roleId:   dto.roleId,
        isActive: dto.isActive,
      },
      select: { ...USER_SELECT, updatedAt: true },
    });

    return user as UserDetail;
  }

  // ─── Update user ─────────────────────────────────────────────────────────────

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserDetail> {
    await this.getUserById(id); // ensures exists

    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (clash) throw new ConflictException('Email already in use by another user');
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined && { name: dto.name }),
        ...(dto.email    !== undefined && { email: dto.email }),
        ...(dto.roleId   !== undefined && { roleId: dto.roleId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { ...USER_SELECT, updatedAt: true },
    });

    return user as UserDetail;
  }

  // ─── Reset password ──────────────────────────────────────────────────────────

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<{ ok: boolean }> {
    await this.getUserById(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  // ─── List roles ──────────────────────────────────────────────────────────────

  async listRoles(): Promise<RoleItem[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        _count: { select: { users: true } },
      },
    });
    return roles;
  }
}
