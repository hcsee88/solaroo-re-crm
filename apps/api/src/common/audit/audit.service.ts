import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { UserContext, PaginatedResult } from '@solaroo/types';
import { Prisma } from '@solaroo/db';

export type AuditLogItem = {
  id: string;
  resource: string;
  resourceId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: unknown;
  performedAt: Date;
  user: { id: string; name: string } | null;
};

/**
 * Lightweight wrapper around the AuditLog table. Inject and call .record(...)
 * from any service that needs to leave a trail (status transitions, approvals,
 * sensitive field changes, etc).
 *
 * Fire-and-forget: callers should `.catch(...)` so audit failure never breaks
 * the main transaction. We log + swallow internally as a backstop.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actor: UserContext | null;
    resource: string;          // e.g. "contract", "project_gate"
    resourceId: string;
    action: string;            // e.g. "stage_changed", "approved", "handover_completed"
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.actor?.id ?? null,
          resource: input.resource,
          resourceId: input.resourceId,
          action: input.action,
          field: input.field ?? null,
          oldValue: input.oldValue ?? null,
          newValue: input.newValue ?? null,
          metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Never let audit failure break the request — log and swallow.
      this.logger.warn(`Audit record failed (${input.resource}/${input.action}): ${(err as Error).message}`);
    }
  }

  /** Paginated query for the admin audit viewer + per-record trails. */
  async findAll(opts: {
    resource?: string;
    resourceId?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<PaginatedResult<AuditLogItem>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(opts.resource   && { resource:   opts.resource }),
      ...(opts.resourceId && { resourceId: opts.resourceId }),
      ...(opts.userId     && { userId:     opts.userId }),
      ...((opts.from || opts.to) && {
        performedAt: {
          ...(opts.from && { gte: opts.from }),
          ...(opts.to   && { lte: opts.to }),
        },
      }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        select: {
          id: true,
          resource: true,
          resourceId: true,
          action: true,
          field: true,
          oldValue: true,
          newValue: true,
          metadata: true,
          performedAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      items: rows as AuditLogItem[],
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    };
  }

  // ─── Edit-meta helpers ──────────────────────────────────────────────────────
  // Used by detail pages to render "Created by X · 2026-04-23" + "Last edited by
  // Y · 18 minutes ago". Both come from the same audit_logs table — no schema
  // changes needed on the resource tables.

  async getCreatedBy(resource: string, resourceId: string): Promise<{ user: { id: string; name: string } | null; at: Date } | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { resource, resourceId, action: 'created' },
      orderBy: { performedAt: 'asc' },
      select: { performedAt: true, user: { select: { id: true, name: true } } },
    });
    return row ? { user: row.user, at: row.performedAt } : null;
  }

  async getLastEdit(resource: string, resourceId: string): Promise<{ user: { id: string; name: string } | null; at: Date; action: string } | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { resource, resourceId },
      orderBy: { performedAt: 'desc' },
      select: { performedAt: true, action: true, user: { select: { id: true, name: true } } },
    });
    return row ? { user: row.user, at: row.performedAt, action: row.action } : null;
  }

  /** Combined fetch for the detail-page "edit meta" pill — single round trip. */
  async getEditMeta(resource: string, resourceId: string): Promise<{
    createdBy: { id: string; name: string } | null;
    createdAt: Date | null;
    lastEditedBy: { id: string; name: string } | null;
    lastEditedAt: Date | null;
    lastEditedAction: string | null;
  }> {
    const [created, last] = await Promise.all([
      this.getCreatedBy(resource, resourceId),
      this.getLastEdit(resource, resourceId),
    ]);
    return {
      createdBy:        created?.user ?? null,
      createdAt:        created?.at ?? null,
      lastEditedBy:     last?.user ?? null,
      lastEditedAt:     last?.at ?? null,
      lastEditedAction: last?.action ?? null,
    };
  }
}
