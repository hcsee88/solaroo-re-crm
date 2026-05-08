import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { Prisma } from '@solaroo/db';
import type { UserContext, PaginatedResult } from '@solaroo/types';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
} from './activities.dto';

export type ActivityItem = {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: Date;
  createdAt: Date;
  ownerUserId: string;
  accountId: string | null;
  contactId: string | null;
  siteId: string | null;
  opportunityId: string | null;
  owner: { id: string; name: string };
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string | null } | null;
  site: { id: string; siteCode: string; name: string } | null;
  opportunity: { id: string; opportunityCode: string; title: string } | null;
};

const ACTIVITY_SELECT = {
  id: true,
  type: true,
  subject: true,
  body: true,
  occurredAt: true,
  createdAt: true,
  ownerUserId: true,
  accountId: true,
  contactId: true,
  siteId: true,
  opportunityId: true,
  owner:       { select: { id: true, name: true } },
  account:     { select: { id: true, name: true } },
  contact:     { select: { id: true, firstName: true, lastName: true } },
  site:        { select: { id: true, siteCode: true, name: true } },
  opportunity: { select: { id: true, opportunityCode: true, title: true } },
} satisfies Prisma.ActivitySelect;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────

  async findAll(
    query: ActivityQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<ActivityItem>> {
    const scope = await this.authz.getBestScope(user, 'activity', 'view');
    if (!scope) throw new ForbiddenException('No permission to view activities');

    // Service-layer scope filter
    const scopeFilter: Prisma.ActivityWhereInput =
      scope === 'own'
        ? { ownerUserId: user.id }
        : scope === 'assigned'
          ? {
              OR: [
                { ownerUserId: user.id },
                { opportunity: { OR: [{ ownerUserId: user.id }, { members: { some: { userId: user.id } } }] } },
                { opportunity: { project: { OR: [{ projectManagerId: user.id }, { members: { some: { userId: user.id } } }] } } },
              ],
            }
          : {}; // 'team' and 'all' fall through to no extra filter

    const where: Prisma.ActivityWhereInput = {
      AND: [
        scopeFilter,
        ...(query.opportunityId ? [{ opportunityId: query.opportunityId }] : []),
        ...(query.accountId     ? [{ accountId: query.accountId }]         : []),
        ...(query.contactId     ? [{ contactId: query.contactId }]         : []),
        ...(query.siteId        ? [{ siteId: query.siteId }]               : []),
        ...(query.ownerUserId   ? [{ ownerUserId: query.ownerUserId }]     : []),
        ...(query.type          ? [{ type: query.type as Prisma.ActivityWhereInput['type'] }] : []),
        ...((query.loggedAfter || query.loggedBefore) ? [{
          occurredAt: {
            ...(query.loggedAfter  && { gte: query.loggedAfter }),
            ...(query.loggedBefore && { lte: query.loggedBefore }),
          },
        }] : []),
      ],
    };

    const [total, items] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ACTIVITY_SELECT,
      }),
    ]);

    return {
      items: items as unknown as ActivityItem[],
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<ActivityItem> {
    const a = await this.prisma.activity.findUnique({ where: { id }, select: ACTIVITY_SELECT });
    if (!a) throw new NotFoundException('Activity not found');
    await this.authz.requirePermission(user, 'activity', 'view', { ownerId: a.ownerUserId });
    return a as unknown as ActivityItem;
  }

  // ─── Create ────────────────────────────────────────────────────────────

  async create(dto: CreateActivityDto, user: UserContext): Promise<ActivityItem> {
    await this.authz.requirePermission(user, 'activity', 'create');

    // Validate linked records exist (lightweight)
    if (dto.opportunityId) {
      const o = await this.prisma.opportunity.findUnique({ where: { id: dto.opportunityId }, select: { id: true, accountId: true, siteId: true } });
      if (!o) throw new NotFoundException('Opportunity not found');
      // Auto-fill account / site from opportunity if not provided
      if (!dto.accountId) dto.accountId = o.accountId;
      if (!dto.siteId)    dto.siteId    = o.siteId;
    }

    const created = await this.prisma.activity.create({
      data: {
        type:          dto.type as Prisma.ActivityCreateInput['type'],
        subject:       dto.subject,
        body:          dto.body,
        occurredAt:    dto.occurredAt,
        ownerUserId:   user.id,
        accountId:     dto.accountId,
        contactId:     dto.contactId,
        siteId:        dto.siteId,
        opportunityId: dto.opportunityId,
      },
      select: { id: true },
    });

    return this.findById(created.id, user);
  }

  // ─── Update ────────────────────────────────────────────────────────────
  // V1 rule (see docs/sales-activity-v1.md):
  //   - Activity timeline is immutable history.
  //   - Edits allowed by the creator ONLY on the same calendar day the
  //     activity was logged (typo / quick correction window).
  //   - DIRECTOR / SUPER_ADMIN can edit any time as a corrective override.

  async update(id: string, dto: UpdateActivityDto, user: UserContext): Promise<ActivityItem> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'activity', 'edit', { ownerId: before.ownerUserId });

    const isAdminOverride = user.roleName === 'DIRECTOR' || user.roleName === 'SUPER_ADMIN';
    if (!isAdminOverride) {
      const isOwner = before.ownerUserId === user.id;
      const sameDay =
        before.createdAt.toDateString() === new Date().toDateString();
      if (!isOwner) {
        throw new ForbiddenException('Only the creator can edit this activity');
      }
      if (!sameDay) {
        throw new BadRequestException(
          'Activities can only be edited on the day they were logged. Add a follow-up activity instead.',
        );
      }
    }

    await this.prisma.activity.update({
      where: { id },
      data: {
        ...(dto.type       !== undefined && { type: dto.type as Prisma.ActivityUpdateInput['type'] }),
        ...(dto.subject    !== undefined && { subject: dto.subject }),
        ...(dto.body       !== undefined && { body: dto.body }),
        ...(dto.occurredAt !== undefined && { occurredAt: dto.occurredAt }),
      },
    });
    return this.findById(id, user);
  }

  // ─── Delete ────────────────────────────────────────────────────────────
  // V1 rule:
  //   - Creator can always delete their own activity.
  //   - SALES_MANAGER can delete any activity in their team scope.
  //   - DIRECTOR / SUPER_ADMIN can delete any activity (corrective override).
  //   - All other roles: 403.

  async delete(id: string, user: UserContext): Promise<void> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'activity', 'delete', { ownerId: before.ownerUserId });

    const isCreator      = before.ownerUserId === user.id;
    const isSalesManager = user.roleName === 'SALES_MANAGER';
    const isAdminOverride = user.roleName === 'DIRECTOR' || user.roleName === 'SUPER_ADMIN';

    if (!isCreator && !isSalesManager && !isAdminOverride) {
      throw new ForbiddenException(
        'Only the creator, Sales Manager, or Director can delete this activity.',
      );
    }

    await this.prisma.activity.delete({ where: { id } });
  }

  // ─── Helpers used by other modules (reporting / opportunities) ─────────

  /** Most recent activity timestamp on an opportunity (or null). */
  async lastActivityAt(opportunityId: string): Promise<Date | null> {
    const a = await this.prisma.activity.findFirst({
      where: { opportunityId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    return a?.occurredAt ?? null;
  }
}
