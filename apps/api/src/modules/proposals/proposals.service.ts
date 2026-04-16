import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import {
  CreateProposalDto,
  CreateVersionDto,
  UpdateVersionDto,
  RecordDecisionDto,
  ProposalQueryDto,
} from './proposals.dto';
import { Prisma } from '@solaroo/db';

// ─── Return types ─────────────────────────────────────────────────────────────

export type ApprovalItem = {
  id: string;
  approvalOrder: number;
  approver: { id: string; name: string; role: { displayName: string } };
  decision: string | null;
  comments: string | null;
  decidedAt: Date | null;
  requestedAt: Date;
};

export type ProposalVersionItem = {
  id: string;
  proposalId: string;
  versionNo: number;
  title: string;
  approvalStatus: string;
  estimatedCapex: string | null;
  estimatedMargin: string | null;
  marginPercent: string | null;
  estimatedSavings: string | null;
  paybackYears: string | null;
  technicalSummary: string | null;
  commercialSummary: string | null;
  submittedForApprovalAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  approvals: ApprovalItem[];
  allowedActions: string[];
};

export type ProposalListItem = {
  id: string;
  proposalCode: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  opportunity: { id: string; opportunityCode: string; title: string };
  account: { id: string; accountCode: string; name: string };
  latestVersion: {
    versionNo: number;
    approvalStatus: string;
    estimatedCapex: string | null;
    marginPercent: string | null;
  } | null;
  _count: { versions: number };
};

export type ProposalDetail = {
  id: string;
  proposalCode: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  opportunity: { id: string; opportunityCode: string; title: string };
  account: { id: string; accountCode: string; name: string };
  site: { id: string; siteCode: string; name: string };
  versions: ProposalVersionItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAllowedActions(
  version: { approvalStatus: string; approvals: ApprovalItem[] },
  user: UserContext,
): string[] {
  const actions: string[] = [];
  const { approvalStatus, approvals } = version;
  const roleLower = user.roleName.toLowerCase();
  const isSalesManager = roleLower.includes('sales');
  const isDirector = roleLower.includes('director') || roleLower.includes('management');

  if (approvalStatus === 'DRAFT') {
    actions.push('submit', 'edit');
  }

  if (approvalStatus === 'SUBMITTED') {
    const pending = approvals.find((a) => a.approvalOrder === 1 && !a.decision);
    if (pending && (pending.approver.id === user.id || isSalesManager)) {
      actions.push('approve', 'reject', 'return');
    }
  }

  if (approvalStatus === 'UNDER_REVIEW') {
    const pending = approvals.find((a) => a.approvalOrder === 2 && !a.decision);
    if (pending && (pending.approver.id === user.id || isDirector)) {
      actions.push('approve', 'reject', 'return');
    }
  }

  if (approvalStatus === 'APPROVED') {
    actions.push('new_version');
  }

  return actions;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Code generation ──────────────────────────────────────────────────────

  private async generateCode(): Promise<string> {
    const yy = new Date().getFullYear().toString().slice(-2);
    const prefix = `PROP-${yy}-`;
    const latest = await this.prisma.proposal.findFirst({
      where:   { proposalCode: { startsWith: prefix } },
      orderBy: { proposalCode: 'desc' },
      select:  { proposalCode: true },
    });
    const next = latest
      ? parseInt(latest.proposalCode.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  // ── Approval user lookup ─────────────────────────────────────────────────

  private async findApprovalUsers(): Promise<{
    salesManagerId: string | null;
    directorId: string | null;
  }> {
    const [salesManagers, directors] = await Promise.all([
      this.prisma.user.findMany({
        where:  { isActive: true, role: { displayName: { contains: 'Sales Manager', mode: 'insensitive' } } },
        select: { id: true },
      }),
      this.prisma.user.findMany({
        where:  { isActive: true, role: { displayName: { contains: 'Director', mode: 'insensitive' } } },
        select: { id: true },
      }),
    ]);
    return {
      salesManagerId: salesManagers[0]?.id ?? null,
      directorId:     directors[0]?.id ?? null,
    };
  }

  // ── List ─────────────────────────────────────────────────────────────────

  async findAll(
    query: ProposalQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<ProposalListItem>> {
    const { opportunityId, accountId, status, page, pageSize, sortBy, sortDir } = query;

    const scope = await this.authz.getBestScope(user, 'proposal', 'view');
    if (!scope) throw new ForbiddenException('No permission to view proposals');

    const scopeFilter: Prisma.ProposalWhereInput =
      scope === 'own'
        ? { createdByUserId: user.id }
        : scope === 'assigned'
          ? {
              OR: [
                { createdByUserId: user.id },
                { opportunity: { members: { some: { userId: user.id } } } },
                { opportunity: { project: { members: { some: { userId: user.id } } } } },
                { opportunity: { project: { projectManagerId: user.id } } },
              ],
            }
          : {};

    const andFilters: Prisma.ProposalWhereInput[] = [scopeFilter];
    const where: Prisma.ProposalWhereInput = {
      AND: andFilters,
      ...(opportunityId && { opportunityId }),
      ...(accountId && { opportunity: { accountId } }),
      ...(status && { versions: { some: { approvalStatus: status as any } } }),
    };

    const canViewMargin = await this.authz.hasPermission(user, 'margin', 'view_estimated');

    const [total, items] = await Promise.all([
      this.prisma.proposal.count({ where }),
      this.prisma.proposal.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, proposalCode: true, title: true,
          createdAt: true, updatedAt: true,
          opportunity: {
            select: {
              id: true, opportunityCode: true, title: true,
              account: { select: { id: true, accountCode: true, name: true } },
            },
          },
          _count: { select: { versions: true } },
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 1,
            select: {
              versionNo: true, approvalStatus: true,
              estimatedCapex: true, marginPercent: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((p) => ({
        id:           p.id,
        proposalCode: p.proposalCode,
        title:        p.title,
        createdAt:    p.createdAt,
        updatedAt:    p.updatedAt,
        opportunity:  {
          id:               p.opportunity.id,
          opportunityCode:  p.opportunity.opportunityCode,
          title:            p.opportunity.title,
        },
        account:       p.opportunity.account,
        latestVersion: p.versions[0]
          ? {
              versionNo:      p.versions[0].versionNo,
              approvalStatus: p.versions[0].approvalStatus,
              estimatedCapex: canViewMargin ? (p.versions[0].estimatedCapex?.toString() ?? null) : null,
              marginPercent:  canViewMargin ? (p.versions[0].marginPercent?.toString() ?? null) : null,
            }
          : null,
        _count: p._count,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<ProposalDetail> {
    const p = await this.prisma.proposal.findUnique({
      where: { id },
      select: {
        id: true, proposalCode: true, title: true,
        createdAt: true, updatedAt: true,
        createdByUserId: true,
        opportunity: {
          select: {
            id: true, opportunityCode: true, title: true,
            account: { select: { id: true, accountCode: true, name: true } },
            site:    { select: { id: true, siteCode: true, name: true } },
            project: { select: { id: true } },
          },
        },
        versions: {
          orderBy: { versionNo: 'desc' },
          select: {
            id: true, proposalId: true, versionNo: true, title: true,
            approvalStatus: true, technicalSummary: true, commercialSummary: true,
            estimatedCapex: true, estimatedMargin: true, marginPercent: true,
            estimatedSavings: true, paybackYears: true,
            submittedForApprovalAt: true, approvedAt: true, createdAt: true,
            approvals: {
              orderBy: { approvalOrder: 'asc' },
              select: {
                id: true, approvalOrder: true, decision: true,
                comments: true, decidedAt: true, requestedAt: true,
                approver: {
                  select: {
                    id: true, name: true,
                    role: { select: { displayName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!p) throw new NotFoundException(`Proposal ${id} not found`);

    await this.authz.requirePermission(user, 'proposal', 'view', {
      ownerId:       p.createdByUserId ?? undefined,
      opportunityId: p.opportunity.id,
      projectId:     p.opportunity.project?.id,
    });

    const canViewMargin = await this.authz.hasPermission(user, 'margin', 'view_estimated');

    const versions: ProposalVersionItem[] = p.versions.map((v) => {
      const approvals: ApprovalItem[] = v.approvals.map((a) => ({
        id:            a.id,
        approvalOrder: a.approvalOrder,
        approver:      a.approver,
        decision:      a.decision,
        comments:      a.comments,
        decidedAt:     a.decidedAt,
        requestedAt:   a.requestedAt,
      }));

      return {
        id:                     v.id,
        proposalId:             v.proposalId,
        versionNo:              v.versionNo,
        title:                  v.title,
        approvalStatus:         v.approvalStatus,
        estimatedCapex:         canViewMargin ? (v.estimatedCapex?.toString() ?? null) : null,
        estimatedMargin:        canViewMargin ? (v.estimatedMargin?.toString() ?? null) : null,
        marginPercent:          canViewMargin ? (v.marginPercent?.toString() ?? null) : null,
        estimatedSavings:       canViewMargin ? (v.estimatedSavings?.toString() ?? null) : null,
        paybackYears:           canViewMargin ? (v.paybackYears?.toString() ?? null) : null,
        technicalSummary:       v.technicalSummary,
        commercialSummary:      canViewMargin ? v.commercialSummary : null,
        submittedForApprovalAt: v.submittedForApprovalAt,
        approvedAt:             v.approvedAt,
        createdAt:              v.createdAt,
        approvals,
        allowedActions:         computeAllowedActions(
          { approvalStatus: v.approvalStatus, approvals },
          user,
        ),
      };
    });

    return {
      id:           p.id,
      proposalCode: p.proposalCode,
      title:        p.title,
      createdAt:    p.createdAt,
      updatedAt:    p.updatedAt,
      opportunity:  {
        id:              p.opportunity.id,
        opportunityCode: p.opportunity.opportunityCode,
        title:           p.opportunity.title,
      },
      account:      p.opportunity.account,
      site:         p.opportunity.site,
      versions,
    };
  }

  // ── Create proposal + version 1 ──────────────────────────────────────────

  async create(dto: CreateProposalDto, user: UserContext): Promise<ProposalDetail> {
    const proposalCode = await this.generateCode();
    const margin = dto.estimatedCapex && dto.marginPercent
      ? (dto.estimatedCapex * dto.marginPercent) / 100
      : undefined;

    const p = await this.prisma.proposal.create({
      data: {
        proposalCode,
        opportunityId:   dto.opportunityId,
        title:           dto.title,
        createdByUserId: user.id,
        versions: {
          create: {
            versionNo:         1,
            title:             dto.title,
            approvalStatus:    'DRAFT',
            estimatedCapex:    dto.estimatedCapex ?? null,
            marginPercent:     dto.marginPercent ?? null,
            estimatedMargin:   margin ?? null,
            estimatedSavings:  dto.estimatedSavings ?? null,
            paybackYears:      dto.paybackYears ?? null,
            technicalSummary:  dto.technicalSummary ?? null,
            commercialSummary: dto.commercialSummary ?? null,
            createdByUserId:   user.id,
          },
        },
      },
      select: { id: true },
    });

    return this.findById(p.id, user);
  }

  // ── Create new version ───────────────────────────────────────────────────

  async createVersion(
    proposalId: string,
    dto: CreateVersionDto,
    user: UserContext,
  ): Promise<ProposalDetail> {
    const proposal = await this.prisma.proposal.findUnique({
      where:  { id: proposalId },
      select: {
        id: true,
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { versionNo: true, approvalStatus: true },
        },
      },
    });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);

    const latest = proposal.versions[0];
    if (latest?.approvalStatus === 'DRAFT') {
      throw new BadRequestException('Current version is still a draft — edit it instead');
    }

    const nextVersionNo = (latest?.versionNo ?? 0) + 1;
    const margin = dto.estimatedCapex && dto.marginPercent
      ? (dto.estimatedCapex * dto.marginPercent) / 100
      : undefined;

    await this.prisma.$transaction([
      this.prisma.proposalVersion.updateMany({
        where: {
          proposalId,
          approvalStatus: { notIn: ['SUPERSEDED', 'REJECTED'] as any[] },
        },
        data: { approvalStatus: 'SUPERSEDED' },
      }),
      this.prisma.proposalVersion.create({
        data: {
          proposalId,
          versionNo:         nextVersionNo,
          title:             dto.title,
          approvalStatus:    'DRAFT',
          estimatedCapex:    dto.estimatedCapex ?? null,
          marginPercent:     dto.marginPercent ?? null,
          estimatedMargin:   margin ?? null,
          estimatedSavings:  dto.estimatedSavings ?? null,
          paybackYears:      dto.paybackYears ?? null,
          technicalSummary:  dto.technicalSummary ?? null,
          commercialSummary: dto.commercialSummary ?? null,
          createdByUserId:   user.id,
        },
      }),
    ]);

    return this.findById(proposalId, user);
  }

  // ── Update draft version ─────────────────────────────────────────────────

  async updateVersion(
    proposalId: string,
    versionNo: number,
    dto: UpdateVersionDto,
    user: UserContext,
  ): Promise<ProposalDetail> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { proposalId_versionNo: { proposalId, versionNo } },
    });
    if (!version) throw new NotFoundException('Version not found');
    if (version.approvalStatus !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT versions can be edited');
    }

    const capex = dto.estimatedCapex ?? (version.estimatedCapex ? Number(version.estimatedCapex) : undefined);
    const pct   = dto.marginPercent  ?? (version.marginPercent  ? Number(version.marginPercent)  : undefined);
    const margin = capex && pct ? (capex * pct) / 100 : undefined;

    await this.prisma.proposalVersion.update({
      where: { proposalId_versionNo: { proposalId, versionNo } },
      data: {
        ...(dto.title             !== undefined && { title: dto.title }),
        ...(dto.estimatedCapex    !== undefined && { estimatedCapex: dto.estimatedCapex }),
        ...(dto.marginPercent     !== undefined && { marginPercent: dto.marginPercent }),
        ...(margin                !== undefined && { estimatedMargin: margin }),
        ...(dto.estimatedSavings  !== undefined && { estimatedSavings: dto.estimatedSavings }),
        ...(dto.paybackYears      !== undefined && { paybackYears: dto.paybackYears }),
        ...(dto.technicalSummary  !== undefined && { technicalSummary: dto.technicalSummary }),
        ...(dto.commercialSummary !== undefined && { commercialSummary: dto.commercialSummary }),
      },
    });

    return this.findById(proposalId, user);
  }

  // ── Submit for approval ──────────────────────────────────────────────────

  async submitForApproval(
    proposalId: string,
    versionNo: number,
    user: UserContext,
  ): Promise<ProposalDetail> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { proposalId_versionNo: { proposalId, versionNo } },
      include: { proposal: { select: { proposalCode: true, title: true } } },
    });
    if (!version) throw new NotFoundException('Version not found');
    if (version.approvalStatus !== 'DRAFT') {
      throw new BadRequestException(`Cannot submit a ${version.approvalStatus} version`);
    }

    const { salesManagerId, directorId } = await this.findApprovalUsers();
    if (!directorId) {
      throw new BadRequestException('No active Director user found to assign as approver. Please create one in Admin → Users.');
    }

    const approvals: Prisma.ProposalApprovalCreateManyInput[] = [];
    if (salesManagerId) {
      approvals.push({ proposalVersionId: version.id, approverUserId: salesManagerId, approvalOrder: 1 });
    }
    approvals.push({
      proposalVersionId: version.id,
      approverUserId:    directorId,
      approvalOrder:     salesManagerId ? 2 : 1,
    });

    await this.prisma.$transaction([
      this.prisma.proposalApproval.createMany({ data: approvals }),
      this.prisma.proposalVersion.update({
        where: { proposalId_versionNo: { proposalId, versionNo } },
        data:  { approvalStatus: 'SUBMITTED', submittedForApprovalAt: new Date() },
      }),
    ]);

    // ── Notify approvers ─────────────────────────────────────────────────────
    const approverIds = [salesManagerId, directorId].filter(
      (id): id is string => !!id && id !== user.id,
    );
    const linkUrl = `/proposals/${proposalId}`;
    const proposalLabel = `${version.proposal.proposalCode} v${versionNo}`;
    this.notifications.createMany(
      approverIds.map((userId) => ({
        userId,
        title: `Proposal approval required: ${proposalLabel}`,
        body:  `"${version.proposal.title}" has been submitted for your review.`,
        type:  'proposal_submitted',
        linkUrl,
        resource:   'proposal',
        resourceId: proposalId,
      })),
    ).catch(() => {});

    return this.findById(proposalId, user);
  }

  // ── Record approval decision ─────────────────────────────────────────────

  async recordDecision(
    proposalId: string,
    versionNo: number,
    dto: RecordDecisionDto,
    user: UserContext,
  ): Promise<ProposalDetail> {
    const version = await this.prisma.proposalVersion.findUnique({
      where:   { proposalId_versionNo: { proposalId, versionNo } },
      include: {
        approvals: { orderBy: { approvalOrder: 'asc' } },
        proposal:  { select: { proposalCode: true, title: true, createdByUserId: true } },
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(version.approvalStatus)) {
      throw new BadRequestException(`Cannot record a decision on a ${version.approvalStatus} version`);
    }

    const roleLower = user.roleName.toLowerCase();
    const isSalesManager = roleLower.includes('sales');
    const isDirector = roleLower.includes('director') || roleLower.includes('management');

    const pendingApproval = version.approvals.find(
      (a) =>
        !a.decision &&
        (a.approverUserId === user.id ||
          (a.approvalOrder === 1 && isSalesManager) ||
          (a.approvalOrder === 2 && isDirector)),
    );
    if (!pendingApproval) {
      throw new ForbiddenException('No pending approval found for your role on this version');
    }

    await this.prisma.proposalApproval.update({
      where: { id: pendingApproval.id },
      data:  { decision: dto.decision as any, comments: dto.comments ?? null, decidedAt: new Date() },
    });

    let newStatus: string;
    if (dto.decision === 'REJECTED') {
      newStatus = 'REJECTED';
    } else if (dto.decision === 'RETURNED') {
      newStatus = 'DRAFT';
      await this.prisma.proposalApproval.deleteMany({ where: { proposalVersionId: version.id } });
    } else {
      const allApprovals = await this.prisma.proposalApproval.findMany({
        where: { proposalVersionId: version.id },
      });
      newStatus = allApprovals.every((a) => a.decision !== null) ? 'APPROVED' : 'UNDER_REVIEW';
    }

    const updateData: Prisma.ProposalVersionUpdateInput = { approvalStatus: newStatus as any };
    if (newStatus === 'APPROVED') updateData.approvedAt = new Date();

    await this.prisma.proposalVersion.update({
      where: { proposalId_versionNo: { proposalId, versionNo } },
      data:  updateData,
    });

    // ── Notify proposal creator of the decision ──────────────────────────────
    const creatorId = version.proposal.createdByUserId;
    if (creatorId && creatorId !== user.id && newStatus !== 'UNDER_REVIEW') {
      const proposalLabel = `${version.proposal.proposalCode} v${versionNo}`;
      const linkUrl = `/proposals/${proposalId}`;
      const decisionMessages: Record<string, { title: string; body: string; type: string }> = {
        APPROVED: {
          title: `Proposal approved: ${proposalLabel}`,
          body:  `"${version.proposal.title}" has been approved.`,
          type:  'proposal_approved',
        },
        REJECTED: {
          title: `Proposal rejected: ${proposalLabel}`,
          body:  `"${version.proposal.title}" was rejected. Check comments and prepare a new version.`,
          type:  'proposal_rejected',
        },
        DRAFT: {
          title: `Proposal returned for revision: ${proposalLabel}`,
          body:  `"${version.proposal.title}" was returned for revision. Check reviewer comments.`,
          type:  'proposal_returned',
        },
      };
      const msg = decisionMessages[newStatus];
      if (msg) {
        this.notifications.create({
          userId: creatorId,
          ...msg,
          linkUrl,
          resource:   'proposal',
          resourceId: proposalId,
        }).catch(() => {});
      }
    }

    return this.findById(proposalId, user);
  }
}
