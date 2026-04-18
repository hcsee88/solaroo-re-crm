import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@solaroo/db';
import type { UserContext } from '@solaroo/types';
import { CreateSavedViewDto, SavedViewQueryDto } from './saved-views.dto';

export type SavedView = {
  id: string;
  module: string;
  name: string;
  filters: unknown;
  columns: unknown;
  sortBy: string | null;
  sortDir: string | null;
  isDefault: boolean;
  createdAt: Date;
};

/**
 * Per-user persistent filter sets. Scoped to (userId, module). No cross-user
 * sharing in V1 — the model lacks a `sharedWith` field. Each row is private
 * to its owner.
 */
@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SavedViewQueryDto, user: UserContext): Promise<SavedView[]> {
    return this.prisma.savedView.findMany({
      where: { userId: user.id, module: query.module },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }) as Promise<SavedView[]>;
  }

  async create(dto: CreateSavedViewDto, user: UserContext): Promise<SavedView> {
    // Enforce unique name per (user, module)
    const dup = await this.prisma.savedView.findFirst({
      where: { userId: user.id, module: dto.module, name: dto.name },
    });
    if (dup) {
      throw new ConflictException(`A saved view named "${dto.name}" already exists`);
    }

    // If marking this view default, unset any existing default for the same scope
    if (dto.isDefault) {
      await this.prisma.savedView.updateMany({
        where: { userId: user.id, module: dto.module, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.savedView.create({
      data: {
        userId:    user.id,
        module:    dto.module,
        name:      dto.name,
        filters:   dto.filters as Prisma.InputJsonValue,
        columns:   (dto.columns ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        sortBy:    dto.sortBy ?? null,
        sortDir:   dto.sortDir ?? null,
        isDefault: dto.isDefault,
      },
    }) as Promise<SavedView>;
  }

  async delete(id: string, user: UserContext): Promise<void> {
    const existing = await this.prisma.savedView.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException('Saved view not found');
    }
    await this.prisma.savedView.delete({ where: { id } });
  }
}
