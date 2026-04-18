import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext, PaginatedResult } from '@solaroo/types';

export type NotificationPayload = {
  userId: string;
  title: string;
  body?: string;
  type: string;
  linkUrl?: string;
  resource?: string;
  resourceId?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  status: string;
  linkUrl: string | null;
  resource: string | null;
  resourceId: string | null;
  createdAt: Date;
  readAt: Date | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create a single notification ─────────────────────────────────────────
  async create(payload: NotificationPayload): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId:     payload.userId,
        title:      payload.title,
        body:       payload.body ?? null,
        type:       payload.type,
        linkUrl:    payload.linkUrl ?? null,
        resource:   payload.resource ?? null,
        resourceId: payload.resourceId ?? null,
      },
    });
  }

  // ── Create notifications for multiple recipients ──────────────────────────
  async createMany(payloads: NotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return;
    await this.prisma.notification.createMany({
      data: payloads.map((p) => ({
        userId:     p.userId,
        title:      p.title,
        body:       p.body ?? null,
        type:       p.type,
        linkUrl:    p.linkUrl ?? null,
        resource:   p.resource ?? null,
        resourceId: p.resourceId ?? null,
      })),
    });
  }

  // ── Find recent notifications for current user ────────────────────────────
  async findAll(user: UserContext): Promise<NotificationItem[]> {
    return this.prisma.notification.findMany({
      where: {
        userId: user.id,
        status: { not: 'DISMISSED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        status: true,
        linkUrl: true,
        resource: true,
        resourceId: true,
        createdAt: true,
        readAt: true,
      },
    }) as Promise<NotificationItem[]>;
  }

  // ── Paginated list (for the full /notifications page) ────────────────────
  async findAllPaginated(
    user: UserContext,
    opts: { page: number; pageSize: number; includeDismissed: boolean },
  ): Promise<PaginatedResult<NotificationItem>> {
    const { page, pageSize, includeDismissed } = opts;
    const where = {
      userId: user.id,
      ...(includeDismissed ? {} : { status: { not: 'DISMISSED' as const } }),
    };
    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          status: true,
          linkUrl: true,
          resource: true,
          resourceId: true,
          createdAt: true,
          readAt: true,
        },
      }),
    ]);
    return {
      items: items as NotificationItem[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ── Unread count (for bell badge) ─────────────────────────────────────────
  async getUnreadCount(user: UserContext): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, status: 'UNREAD' },
    });
    return { count };
  }

  // ── Mark a single notification as read ────────────────────────────────────
  async markRead(id: string, user: UserContext): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  // ── Mark all as read ──────────────────────────────────────────────────────
  async markAllRead(user: UserContext): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  // ── Dismiss a notification ────────────────────────────────────────────────
  async dismiss(id: string, user: UserContext): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { status: 'DISMISSED' },
    });
  }

  // ── Helpers for finding role-based recipients ─────────────────────────────

  /** Get IDs of all active users with any of the given role names */
  async getUserIdsByRoles(roleNames: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, role: { name: { in: roleNames } } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** Get IDs of all members on a project (not including PM — add separately).
   *  Uses ProjectMember (canonical access-control table), not ProjectTeamAssignment. */
  async getProjectMemberIds(projectId: string): Promise<string[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }
}
