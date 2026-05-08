import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  TransitionStageDto,
  OpportunityQueryDto,
} from './opportunities.dto';
import { Prisma, OpportunityStage } from '@solaroo/db';
import {
  assertValidTransition,
  OPPORTUNITY_STAGE_TRANSITIONS,
} from '@solaroo/workflows';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  computeOpportunityHealth,
  computeNextActionStatus,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  type OpportunityHealth,
  type EffectiveNextActionStatus,
} from './opportunity-health';
import type { UpdateNextActionDto } from './opportunities.dto';

// ─── Shared select shape ──────────────────────────────────────────────────────

const OPP_SELECT = {
  id: true,
  opportunityCode: true,
  title: true,
  stage: true,
  commercialModel: true,
  estimatedValue: true,
  estimatedPvKwp: true,
  estimatedBessKw: true,
  estimatedBessKwh: true,
  probabilityPercent: true,
  expectedAwardDate: true,
  summary: true,
  risks: true,
  competitors: true,
  lostReason: true,
  nextAction: true,
  nextActionDueDate: true,
  lastStatusNote: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  accountId: true,
  siteId: true,
  ownerUserId: true,
  designEngineerId: true,
  account: { select: { id: true, accountCode: true, name: true } },
  site: { select: { id: true, siteCode: true, name: true, gridCategory: true } },
  owner: { select: { id: true, name: true, email: true } },
  designEngineer: { select: { id: true, name: true, email: true } },
} as const;

export type OpportunityRecord = {
  id: string;
  opportunityCode: string;
  title: string;
  stage: OpportunityStage;
  commercialModel: string | null;
  estimatedValue: unknown;
  estimatedPvKwp: unknown;
  estimatedBessKw: unknown;
  estimatedBessKwh: unknown;
  probabilityPercent: number | null;
  expectedAwardDate: Date | null;
  summary: string | null;
  risks: string | null;
  competitors: string | null;
  lostReason: string | null;
  nextAction: string | null;
  nextActionDueDate: Date | null;
  lastStatusNote: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  accountId: string;
  siteId: string;
  ownerUserId: string;
  designEngineerId: string | null;
  account: { id: string; accountCode: string; name: string };
  site: { id: string; siteCode: string; name: string; gridCategory: string };
  owner: { id: string; name: string; email: string };
  designEngineer: { id: string; name: string; email: string } | null;
};

export type OpportunityListItem = OpportunityRecord & {
  _count: { proposals: number };
};

export type OpportunityDetail = OpportunityRecord & {
  stageHistory: {
    id: string;
    fromStage: OpportunityStage | null;
    toStage: OpportunityStage;
    reason: string | null;
    changedAt: Date;
  }[];
  allowedNextStages: OpportunityStage[];
  // V1 sales pipeline computed fields
  lastActivityAt: Date | null;
  health: OpportunityHealth;
  effectiveNextActionStatus: EffectiveNextActionStatus;
};

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(
    query: OpportunityQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<OpportunityListItem & { health: OpportunityHealth; lastActivityAt: Date | null; effectiveNextActionStatus: EffectiveNextActionStatus }>> {
    const { search, accountId, siteId, ownerUserId, designEngineerId, stage, isActive, overdue, page, pageSize, sortBy, sortDir } = query;

    // ── Scope enforcement ──────────────────────────────────────────────────
    const scope = await this.authz.getBestScope(user, 'opportunity', 'view');
    if (!scope) throw new ForbiddenException('No permission to view opportunities');

    // Build scope-based filter:
    //   own      → only where ownerUserId = me
    //   assigned → ownerUserId = me  OR  OpportunityMember  OR  ProjectMember on linked project
    //              (PROJECT_ENGINEER is a ProjectMember, not an OpportunityMember)
    //   team/all → no extra filter (Sales Manager sees their team; Director sees all)
    // 'own' includes both Sales Engineer (ownerUserId) and Design Engineer (designEngineerId)
    // ownership tags, since both roles legitimately "own" the opp from their angle.
    const scopeFilter: Prisma.OpportunityWhereInput =
      scope === 'own'
        ? { OR: [{ ownerUserId: user.id }, { designEngineerId: user.id }] }
        : scope === 'assigned'
          ? {
              OR: [
                { ownerUserId: user.id },
                { designEngineerId: user.id },
                { members: { some: { userId: user.id } } },
                // Project-member path: PE/PM are assigned at project level, not opp level
                { project: { members: { some: { userId: user.id } } } },
                { project: { projectManagerId: user.id } },
              ],
            }
          : {};

    const now = new Date();
    const andFilters: Prisma.OpportunityWhereInput[] = [scopeFilter];
    if (search) {
      andFilters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { opportunityCode: { contains: search, mode: 'insensitive' } },
          { account: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    // Sales-pipeline filter chips — translate each into a Prisma sub-clause
    if (query.myOnly)               andFilters.push({ ownerUserId: user.id });
    if (query.mineAsDesignEngineer) andFilters.push({ designEngineerId: user.id });
    if (query.closingThisMonth)     andFilters.push({ expectedAwardDate: { gte: startOfMonth(now), lte: endOfMonth(now) } });
    if (query.closingThisQuarter)   andFilters.push({ expectedAwardDate: { gte: startOfQuarter(now), lte: endOfQuarter(now) } });
    if (query.noNextAction)         andFilters.push({ OR: [{ nextAction: null }, { nextAction: '' }] });
    if (query.overdueNextAction)    andFilters.push({ AND: [{ nextActionStatus: 'PENDING' }, { nextActionDueDate: { lt: now } }, { stage: { notIn: ['WON', 'LOST'] } }] });
    if (query.proposalSubmitted)    andFilters.push({ stage: { in: ['BUDGETARY_PROPOSAL', 'FIRM_PROPOSAL'] } });
    if (query.highValue)            andFilters.push({ estimatedValue: { gte: 1_000_000 } });
    if (query.wonThisMonth)         andFilters.push({ AND: [{ stage: 'WON' }, { updatedAt: { gte: startOfMonth(now), lte: endOfMonth(now) } }] });
    if (query.lostThisMonth)        andFilters.push({ AND: [{ stage: 'LOST' }, { updatedAt: { gte: startOfMonth(now), lte: endOfMonth(now) } }] });
    if (query.won)                  andFilters.push({ stage: 'WON' });
    if (query.lost)                 andFilters.push({ stage: 'LOST' });
    // No-activity filters use Prisma's `none` quantifier on the activities relation
    if (query.noActivity14d) {
      const cutoff = new Date(now.getTime() - 14 * 86_400_000);
      andFilters.push({ activities: { none: { occurredAt: { gte: cutoff } } } });
    }
    if (query.noActivity30d) {
      const cutoff = new Date(now.getTime() - 30 * 86_400_000);
      andFilters.push({ activities: { none: { occurredAt: { gte: cutoff } } } });
    }
    // Effective next-action status filter
    if (query.nextActionStatus === 'PENDING') {
      andFilters.push({ AND: [{ nextActionStatus: 'PENDING' }, { OR: [{ nextActionDueDate: null }, { nextActionDueDate: { gte: now } }] }] });
    } else if (query.nextActionStatus === 'OVERDUE') {
      andFilters.push({ AND: [{ nextActionStatus: 'PENDING' }, { nextActionDueDate: { lt: now } }] });
    } else if (query.nextActionStatus === 'COMPLETED') {
      andFilters.push({ nextActionStatus: 'COMPLETED' });
    }

    const where: Prisma.OpportunityWhereInput = {
      AND: andFilters,
      ...(accountId && { accountId }),
      ...(siteId && { siteId }),
      ...(ownerUserId && { ownerUserId }),
      ...(designEngineerId && { designEngineerId }),
      ...(stage && { stage }),
      ...(isActive !== undefined && { isActive }),
      // Legacy 'overdue' flag — kept for backwards compatibility
      ...(overdue && {
        nextActionDueDate: { lt: now },
        stage: { notIn: ['WON', 'LOST'] },
      }),
    };

    // ── Sensitive field gate ───────────────────────────────────────────────
    const canViewValue = await this.authz.hasPermission(user, 'margin', 'view_estimated');

    const [total, items] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...OPP_SELECT,
          nextActionType:    true,
          nextActionStatus:  true,
          nextActionOwnerId: true,
          _count: { select: { proposals: true, activities: true } },
          activities: {
            take: 1,
            orderBy: { occurredAt: 'desc' },
            select: { occurredAt: true },
          },
        },
      }),
    ]);

    // Enrich + strip
    const mappedItems = (items as Array<OpportunityListItem & {
      nextActionStatus: 'PENDING' | 'COMPLETED' | null;
      activities: { occurredAt: Date }[];
    }>).map((item) => {
      const lastActivityAt = item.activities[0]?.occurredAt ?? null;
      const enriched = {
        ...item,
        lastActivityAt,
        health: computeOpportunityHealth({
          stage:             item.stage,
          nextAction:        item.nextAction,
          nextActionDueDate: item.nextActionDueDate,
          nextActionStatus:  item.nextActionStatus,
          lastActivityAt,
          now,
        }),
        effectiveNextActionStatus: computeNextActionStatus({
          nextAction:        item.nextAction,
          nextActionDueDate: item.nextActionDueDate,
          nextActionStatus:  item.nextActionStatus,
          now,
        }),
      };
      // Drop the raw activities array we used only for computation
      delete (enriched as Record<string, unknown>).activities;
      // Strip estimatedValue for roles without pipeline value visibility
      if (!canViewValue) {
        delete (enriched as Record<string, unknown>).estimatedValue;
      }
      return enriched;
    });

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<OpportunityDetail> {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        ...OPP_SELECT,
        // Project ID needed for PE scope check (PE is ProjectMember, not OpportunityMember)
        project: { select: { id: true } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          select: {
            id: true,
            fromStage: true,
            toStage: true,
            reason: true,
            changedAt: true,
          },
        },
      },
    });

    if (!opp) throw new NotFoundException(`Opportunity ${id} not found`);

    // ── Record-level access check ──────────────────────────────────────────
    await this.authz.requirePermission(user, 'opportunity', 'view', {
      ownerId:       opp.ownerUserId,
      opportunityId: id,
      projectId:     opp.project?.id,   // allows PE/PM to pass via ProjectMember check
    });

    // ── Sensitive field: estimatedValue ────────────────────────────────────
    // estimatedValue (estimated contract value / deal size) is commercially
    // sensitive. Execution roles (PE, PM, PMO, Design, Procurement, Site etc.)
    // should not see pipeline deal values — they work from project scope only.
    // UI already hides this via canSeeOpportunityValue(); enforce at backend too.
    const canViewValue = await this.authz.hasPermission(user, 'margin', 'view_estimated');
    const record = opp as unknown as Record<string, unknown>;
    if (!canViewValue) {
      delete record['estimatedValue'];
    }

    const allowedNextStages = OPPORTUNITY_STAGE_TRANSITIONS[opp.stage].allowedNext as OpportunityStage[];

    // Compute live health + effective next-action status. Cheap; one extra query.
    const lastAct = await this.prisma.activity.findFirst({
      where: { opportunityId: id },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    const lastActivityAt = lastAct?.occurredAt ?? null;
    const now = new Date();
    const health = computeOpportunityHealth({
      stage: opp.stage,
      nextAction: (record as { nextAction?: string | null }).nextAction,
      nextActionDueDate: (record as { nextActionDueDate?: Date | null }).nextActionDueDate,
      nextActionStatus: (record as { nextActionStatus?: 'PENDING' | 'COMPLETED' | null }).nextActionStatus,
      lastActivityAt,
      now,
    });
    const effectiveNextActionStatus = computeNextActionStatus({
      nextAction: (record as { nextAction?: string | null }).nextAction,
      nextActionDueDate: (record as { nextActionDueDate?: Date | null }).nextActionDueDate,
      nextActionStatus: (record as { nextActionStatus?: 'PENDING' | 'COMPLETED' | null }).nextActionStatus,
      now,
    });

    return {
      ...(record as unknown as OpportunityRecord),
      stageHistory: opp.stageHistory,
      allowedNextStages,
      lastActivityAt,
      health,
      effectiveNextActionStatus,
    } as OpportunityDetail;
  }

  // ─── Next-action update (lighter than full opportunity edit) ──────────────

  async updateNextAction(id: string, dto: UpdateNextActionDto, user: UserContext): Promise<OpportunityDetail> {
    // Reuse findById's scope check
    const before = await this.findById(id, user);
    // Owner OR opportunity:edit-team-or-all may modify next action
    await this.authz.requirePermission(user, 'opportunity', 'edit', {
      ownerId: before.ownerUserId,
      opportunityId: id,
    });

    // If status is being flipped to COMPLETED, stamp completion timestamp
    const willComplete = dto.nextActionStatus === 'COMPLETED' && before.effectiveNextActionStatus !== 'COMPLETED';

    await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...(dto.nextAction        !== undefined && { nextAction:        dto.nextAction }),
        ...(dto.nextActionType    !== undefined && { nextActionType:    dto.nextActionType }),
        ...(dto.nextActionDueDate !== undefined && { nextActionDueDate: dto.nextActionDueDate }),
        ...(dto.nextActionOwnerId !== undefined && { nextActionOwnerId: dto.nextActionOwnerId }),
        ...(dto.nextActionStatus  !== undefined && { nextActionStatus:  dto.nextActionStatus }),
        ...(willComplete && { nextActionCompletedAt: new Date() }),
        ...(dto.nextActionStatus === 'PENDING' && { nextActionCompletedAt: null }),
      },
    });

    // Audit
    this.audit.record({
      actor: user,
      resource: 'opportunity',
      resourceId: id,
      action: willComplete ? 'next_action_completed' : 'next_action_updated',
      metadata: {
        nextActionType: dto.nextActionType,
        nextActionDueDate: dto.nextActionDueDate ? String(dto.nextActionDueDate) : null,
        nextActionOwnerId: dto.nextActionOwnerId,
      },
    }).catch(() => {});

    return this.findById(id, user);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateOpportunityDto, user: UserContext): Promise<OpportunityDetail> {
    const opportunityCode = await this.generateCode();

    const opp = await this.prisma.opportunity.create({
      data: {
        ...dto,
        opportunityCode,
        stage: 'LEAD',
        estimatedValue: dto.estimatedValue ?? null,
        estimatedPvKwp: dto.estimatedPvKwp ?? null,
        estimatedBessKw: dto.estimatedBessKw ?? null,
        estimatedBessKwh: dto.estimatedBessKwh ?? null,
        expectedAwardDate: dto.expectedAwardDate ? new Date(dto.expectedAwardDate) : null,
        stageHistory: {
          create: {
            fromStage: null,
            toStage: 'LEAD',
            changedByUserId: user.id,
            reason: 'Opportunity created',
          },
        },
      },
      select: {
        ...OPP_SELECT,
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          select: { id: true, fromStage: true, toStage: true, reason: true, changedAt: true },
        },
      },
    });

    // Create document folder structure for the new opportunity (best-effort)
    const folderSlugs = ['site-information', 'drawings', 'costing', 'proposal', 'contracts', 'other'];
    const oppUploadsBase = path.join(process.cwd(), 'uploads', 'opportunities', opp.id);
    await Promise.all(
      folderSlugs.map((slug) =>
        fs.mkdir(path.join(oppUploadsBase, slug), { recursive: true }).catch(() => {}),
      ),
    );

    // Return via findById so the new health/lastActivity/effectiveStatus fields are populated
    return this.findById(opp.id, user);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateOpportunityDto, user: UserContext): Promise<OpportunityDetail> {
    await this.findById(id, user);

    const opp = await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...dto,
        estimatedValue: dto.estimatedValue ?? undefined,
        estimatedPvKwp: dto.estimatedPvKwp ?? undefined,
        estimatedBessKw: dto.estimatedBessKw ?? undefined,
        estimatedBessKwh: dto.estimatedBessKwh ?? undefined,
        // Date conversions: null = clear column, undefined = leave unchanged, string = parse
        expectedAwardDate:
          dto.expectedAwardDate === null
            ? null
            : dto.expectedAwardDate
              ? new Date(dto.expectedAwardDate)
              : undefined,
        nextActionDueDate:
          dto.nextActionDueDate === null
            ? null
            : dto.nextActionDueDate
              ? new Date(dto.nextActionDueDate)
              : undefined,
      },
      select: {
        ...OPP_SELECT,
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          select: { id: true, fromStage: true, toStage: true, reason: true, changedAt: true },
        },
      },
    });

    return this.findById(opp.id, user);
  }

  // ─── Stage transition ─────────────────────────────────────────────────────

  async transitionStage(
    id: string,
    dto: TransitionStageDto,
    user: UserContext,
  ): Promise<OpportunityDetail> {
    const current = await this.findById(id, user);

    // Validate transition using workflow rules
    try {
      assertValidTransition(current.stage, dto.toStage as OpportunityStage);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid stage transition');
    }

    // LOST requires a reason
    if (dto.toStage === 'LOST' && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required when marking an opportunity as Lost');
    }

    const opp = await this.prisma.opportunity.update({
      where: { id },
      data: {
        stage: dto.toStage as OpportunityStage,
        ...(dto.toStage === 'LOST' && { lostReason: dto.reason }),
        stageHistory: {
          create: {
            fromStage: current.stage,
            toStage: dto.toStage as OpportunityStage,
            changedByUserId: user.id,
            reason: dto.reason ?? null,
          },
        },
      },
      select: {
        ...OPP_SELECT,
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          select: { id: true, fromStage: true, toStage: true, reason: true, changedAt: true },
        },
      },
    });

    const allowedNextStages = OPPORTUNITY_STAGE_TRANSITIONS[dto.toStage as OpportunityStage].allowedNext as OpportunityStage[];
    const result = { ...(opp as unknown as OpportunityRecord), stageHistory: opp.stageHistory, allowedNextStages };

    // Auto-create project when marked WON
    let newProjectId: string | undefined;
    if (dto.toStage === 'WON' && dto.projectCode && dto.projectManagerId && dto.projectName) {
      const project = await this.projectsService.create(
        {
          projectCode:      dto.projectCode,
          name:             dto.projectName,
          opportunityId:    id,
          accountId:        current.accountId,
          siteId:           current.siteId,
          projectManagerId: dto.projectManagerId,
          budgetBaseline:   dto.budgetBaseline,
          startDate:        dto.startDate,
          targetCod:        dto.targetCod,
        },
        user,
      );
      newProjectId = project?.id;
    }

    // Audit + notifications — fire-and-forget so failures don't break the transition
    this.audit.record({
      actor: user,
      resource: 'opportunity',
      resourceId: id,
      action: 'stage_changed',
      field: 'stage',
      oldValue: current.stage,
      newValue: dto.toStage,
      metadata: {
        ...(dto.reason && { reason: dto.reason }),
        ...(newProjectId && { projectCreated: newProjectId }),
      },
    }).catch(() => {});

    this.sendStageNotifications(
      result,
      current.stage,
      dto.toStage as OpportunityStage,
      dto,
      user,
      newProjectId,
    ).catch(() => {});

    // Return enriched detail (health/lastActivityAt/effectiveNextActionStatus computed)
    return this.findById(id, user);
  }

  // ─── Stage transition notifications ──────────────────────────────────────

  private async sendStageNotifications(
    opp: OpportunityRecord,
    fromStage: OpportunityStage,
    toStage: OpportunityStage,
    dto: TransitionStageDto,
    actor: UserContext,
    newProjectId: string | undefined,
  ): Promise<void> {
    const oppLink = `/opportunities/${opp.id}`;
    const projectLink = newProjectId ? `/projects/${newProjectId}` : oppLink;

    if (toStage === 'WON') {
      // Notify the new PM + all DIRECTOR + SALES_MANAGER users
      const directorIds = await this.notifications.getUserIdsByRoles([
        'DIRECTOR',
        'SALES_MANAGER',
      ]);
      const recipients = new Set<string>(directorIds);
      if (dto.projectManagerId) recipients.add(dto.projectManagerId);
      recipients.delete(actor.id);
      if (recipients.size === 0) return;
      const valueText =
        opp.estimatedValue != null ? ` · est. value ${String(opp.estimatedValue)}` : '';
      await this.notifications.createMany(
        Array.from(recipients).map((userId) => ({
          userId,
          title: `Opportunity won — ${opp.opportunityCode}`,
          body: `${dto.projectName ?? opp.title}${valueText}`,
          type: 'opp_won',
          linkUrl: projectLink,
          resource: 'opportunity',
          resourceId: opp.id,
        })),
      );
      return;
    }

    if (toStage === 'LOST') {
      const managerIds = await this.notifications.getUserIdsByRoles([
        'SALES_MANAGER',
        'DIRECTOR',
      ]);
      const recipients = new Set<string>(managerIds);
      recipients.add(opp.ownerUserId);
      recipients.delete(actor.id);
      if (recipients.size === 0) return;
      const reasonText = dto.reason ? ` Reason: ${dto.reason}` : '';
      await this.notifications.createMany(
        Array.from(recipients).map((userId) => ({
          userId,
          title: `Opportunity lost — ${opp.opportunityCode}`,
          body: `${opp.title}.${reasonText}`,
          type: 'opp_lost',
          linkUrl: oppLink,
          resource: 'opportunity',
          resourceId: opp.id,
        })),
      );
      return;
    }

    // Other transitions — notify the opportunity owner only (skip if owner == actor)
    if (opp.ownerUserId === actor.id) return;
    await this.notifications.create({
      userId: opp.ownerUserId,
      title: `Opportunity moved to ${toStage} — ${opp.opportunityCode}`,
      body: `${opp.title} · ${fromStage} → ${toStage}`,
      type: 'opp_stage_changed',
      linkUrl: oppLink,
      resource: 'opportunity',
      resourceId: opp.id,
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────
  // Hard-delete an opportunity. Cascades stage history + members + activities
  // (junction-style data); refuses if a Project or Proposal already exists for it.

  async delete(id: string, user: UserContext): Promise<{ ok: true }> {
    // findById enforces scope-based view permission and throws if not found.
    // We additionally need the 'edit' (or 'delete') scope; the controller
    // already gates with @RequirePermission('opportunity', 'delete').
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        opportunityCode: true,
        // Pull the proposal codes (not just count) so the error message can
        // tell the user exactly which proposals to delete first.
        proposals: { select: { proposalCode: true } },
        project: { select: { id: true, projectCode: true } },
      },
    });
    if (!existing) throw new NotFoundException(`Opportunity ${id} not found`);

    const blockers: string[] = [];
    if (existing.proposals.length > 0) {
      const codes = existing.proposals.map((p) => p.proposalCode).join(', ');
      blockers.push(`proposal${existing.proposals.length === 1 ? '' : 's'} ${codes}`);
    }
    if (existing.project) blockers.push(`project ${existing.project.projectCode}`);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete opportunity ${existing.opportunityCode} because ${blockers.join(' and ')} still exist. Open ${blockers.join(' / ')}, delete ${existing.proposals.length + (existing.project ? 1 : 0) === 1 ? 'it' : 'them'} first, then return to delete this opportunity.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.activity.deleteMany({ where: { opportunityId: id } }),
      this.prisma.opportunityStageHistory.deleteMany({ where: { opportunityId: id } }),
      this.prisma.opportunityMember.deleteMany({ where: { opportunityId: id } }),
      this.prisma.opportunity.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  // ─── Code generator ────────────────────────────────────────────────────────

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(2); // "25"
    const prefix = `OPP-${year}-`;

    const latest = await this.prisma.opportunity.findFirst({
      where: { opportunityCode: { startsWith: prefix } },
      orderBy: { opportunityCode: 'desc' },
      select: { opportunityCode: true },
    });

    let nextNum = 1;
    if (latest) {
      const match = latest.opportunityCode.match(/-(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }
}
