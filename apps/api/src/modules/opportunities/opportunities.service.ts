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
  account: { select: { id: true, accountCode: true, name: true } },
  site: { select: { id: true, siteCode: true, name: true, gridCategory: true } },
  owner: { select: { id: true, name: true, email: true } },
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
  account: { id: string; accountCode: string; name: string };
  site: { id: string; siteCode: string; name: string; gridCategory: string };
  owner: { id: string; name: string; email: string };
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
  ): Promise<PaginatedResult<OpportunityListItem>> {
    const { search, accountId, siteId, ownerUserId, stage, isActive, overdue, page, pageSize, sortBy, sortDir } = query;

    // ── Scope enforcement ──────────────────────────────────────────────────
    const scope = await this.authz.getBestScope(user, 'opportunity', 'view');
    if (!scope) throw new ForbiddenException('No permission to view opportunities');

    // Build scope-based filter:
    //   own      → only where ownerUserId = me
    //   assigned → ownerUserId = me  OR  OpportunityMember  OR  ProjectMember on linked project
    //              (PROJECT_ENGINEER is a ProjectMember, not an OpportunityMember)
    //   team/all → no extra filter (Sales Manager sees their team; Director sees all)
    const scopeFilter: Prisma.OpportunityWhereInput =
      scope === 'own'
        ? { ownerUserId: user.id }
        : scope === 'assigned'
          ? {
              OR: [
                { ownerUserId: user.id },
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

    const where: Prisma.OpportunityWhereInput = {
      AND: andFilters,
      ...(accountId && { accountId }),
      ...(siteId && { siteId }),
      ...(ownerUserId && { ownerUserId }),
      ...(stage && { stage }),
      ...(isActive !== undefined && { isActive }),
      // Overdue: nextActionDueDate is in the past, and deal is still open
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
          _count: { select: { proposals: true } },
        },
      }),
    ]);

    // Strip estimatedValue for roles without pipeline value visibility
    const mappedItems = (items as OpportunityListItem[]).map((item) => {
      if (!canViewValue) {
        const r = item as Record<string, unknown>;
        delete r['estimatedValue'];
      }
      return item;
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

    return { ...(record as unknown as OpportunityRecord), stageHistory: opp.stageHistory, allowedNextStages };
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

    const allowedNextStages = OPPORTUNITY_STAGE_TRANSITIONS['LEAD'].allowedNext as OpportunityStage[];
    return { ...(opp as unknown as OpportunityRecord), stageHistory: opp.stageHistory, allowedNextStages };
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
        expectedAwardDate: dto.expectedAwardDate ? new Date(dto.expectedAwardDate) : undefined,
        nextActionDueDate: dto.nextActionDueDate ? new Date(dto.nextActionDueDate) : undefined,
      },
      select: {
        ...OPP_SELECT,
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          select: { id: true, fromStage: true, toStage: true, reason: true, changedAt: true },
        },
      },
    });

    const allowedNextStages = OPPORTUNITY_STAGE_TRANSITIONS[opp.stage].allowedNext as OpportunityStage[];
    return { ...(opp as unknown as OpportunityRecord), stageHistory: opp.stageHistory, allowedNextStages };
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

    return result;
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
