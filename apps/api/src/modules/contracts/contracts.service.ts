import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { Prisma, ContractStatus, HandoverStatus } from '@solaroo/db';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractQueryDto,
  TransitionStatusDto,
  StartHandoverDto,
  UpdateChecklistItemDto,
  CompleteHandoverDto,
} from './contracts.dto';
import {
  CreateContractMilestoneDto,
  UpdateContractMilestoneDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
} from './contract-children.dto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  completedAt?: string | null;
  completedById?: string | null;
};

export type ContractListItem = {
  id: string;
  contractNo: string;
  title: string;
  status: ContractStatus;
  handoverStatus: HandoverStatus;
  contractValue: unknown;
  currency: string;
  awardedDate: Date | null;
  targetCod: Date | null;
  createdAt: Date;
  updatedAt: Date;
  account: { id: string; accountCode: string; name: string };
  opportunity: { id: string; opportunityCode: string; title: string } | null;
  project: { id: string; projectCode: string } | null;
  projectManagerCandidate: { id: string; name: string } | null;
};

export type ContractDetail = ContractListItem & {
  scopeSummary: string | null;
  paymentTerms: string | null;
  retentionPercent: unknown;
  signedDate: Date | null;
  commencementDate: Date | null;
  completionDate: Date | null;
  defectsLiabilityMonths: number | null;
  notes: string | null;
  fileUrl: string | null;
  handoverChecklist: ChecklistItem[];
  handoverCompletedAt: Date | null;
  handoverCompletedBy: { id: string; name: string } | null;
  site: { id: string; siteCode: string; name: string } | null;
  proposalVersion: { id: string; versionNo: number; title: string } | null;
};

// ─── Default handover checklist ──────────────────────────────────────────────

const DEFAULT_HANDOVER_CHECKLIST: { key: string; label: string }[] = [
  { key: 'signed_contract',     label: 'Signed contract uploaded'                       },
  { key: 'site_visit',          label: 'Site visit confirmed'                            },
  { key: 'design_basis',        label: 'Design Basis Document accepted by customer'      },
  { key: 'long_lead',           label: 'Long-lead procurement items identified'          },
  { key: 'pm_assigned',         label: 'Project Manager assigned and briefed'            },
  { key: 'kickoff_scheduled',   label: 'Internal kickoff meeting scheduled'              },
];

// ─── Allowed status transitions ──────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT:        ['UNDER_REVIEW', 'AWARDED'],
  UNDER_REVIEW: ['DRAFT', 'AWARDED'],
  AWARDED:      ['SIGNED', 'ACTIVE'],
  SIGNED:       ['ACTIVE', 'CLOSED', 'DISPUTED', 'TERMINATED'],
  ACTIVE:       ['CLOSED', 'DISPUTED', 'TERMINATED'],
  CLOSED:       [],
  DISPUTED:     ['ACTIVE', 'CLOSED', 'TERMINATED'],
  TERMINATED:   [],
};

// ─── Select shapes ────────────────────────────────────────────────────────────

const CONTRACT_LIST_SELECT = {
  id: true,
  contractNo: true,
  title: true,
  status: true,
  handoverStatus: true,
  contractValue: true,
  currency: true,
  awardedDate: true,
  targetCod: true,
  createdAt: true,
  updatedAt: true,
  account: { select: { id: true, accountCode: true, name: true } },
  opportunity: { select: { id: true, opportunityCode: true, title: true } },
  project: { select: { id: true, projectCode: true } },
  projectManagerCandidate: { select: { id: true, name: true } },
} satisfies Prisma.ContractSelect;

const CONTRACT_DETAIL_SELECT = {
  ...CONTRACT_LIST_SELECT,
  scopeSummary: true,
  paymentTerms: true,
  retentionPercent: true,
  signedDate: true,
  commencementDate: true,
  completionDate: true,
  defectsLiabilityMonths: true,
  notes: true,
  fileUrl: true,
  handoverChecklist: true,
  handoverCompletedAt: true,
  handoverCompletedBy: { select: { id: true, name: true } },
  site: { select: { id: true, siteCode: true, name: true } },
  proposalVersion: { select: { id: true, versionNo: true, title: true } },
} satisfies Prisma.ContractSelect;

// ═════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    private readonly notifications: NotificationsService,
    private readonly projectsService: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────────

  async findAll(
    query: ContractQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<ContractListItem>> {
    const { search, status, handoverStatus, accountId, opportunityId, page, pageSize, sortBy, sortDir } = query;

    const scope = await this.authz.getBestScope(user, 'contract', 'view');
    if (!scope) throw new ForbiddenException('No permission to view contracts');

    // Service-layer scope: contracts have no per-record member model, so
    // 'assigned' falls back to "the contract is linked to a project I'm a member
    // of" or "I'm the PM candidate". 'team' = same as 'all' for this V1.
    const scopeFilter: Prisma.ContractWhereInput =
      scope === 'assigned'
        ? {
            OR: [
              { projectManagerCandidateId: user.id },
              { project: { projectManagerId: user.id } },
              { project: { members: { some: { userId: user.id } } } },
            ],
          }
        : {};

    const andFilters: Prisma.ContractWhereInput[] = [scopeFilter];
    if (search) {
      andFilters.push({
        OR: [
          { contractNo: { contains: search, mode: 'insensitive' } },
          { title:      { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ContractWhereInput = {
      AND: andFilters,
      ...(status         && { status }),
      ...(handoverStatus && { handoverStatus }),
      ...(accountId      && { accountId }),
      ...(opportunityId  && { opportunityId }),
    };

    const [total, items] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: CONTRACT_LIST_SELECT,
      }),
    ]);

    return {
      items: items as unknown as ContractListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ─── Get one ─────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<ContractDetail> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: CONTRACT_DETAIL_SELECT,
    });
    if (!contract) throw new NotFoundException('Contract not found');

    // Record-level scope check
    await this.authz.requirePermission(user, 'contract', 'view', {
      ownerId: contract.projectManagerCandidate?.id ?? undefined,
      projectId: contract.project?.id ?? undefined,
    });

    return {
      ...(contract as unknown as ContractDetail),
      handoverChecklist: this.normaliseChecklist(contract.handoverChecklist),
    };
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(dto: CreateContractDto, user: UserContext): Promise<ContractDetail> {
    await this.authz.requirePermission(user, 'contract', 'create');

    const codeExists = await this.prisma.contract.findUnique({
      where: { contractNo: dto.contractNo },
    });
    if (codeExists) {
      throw new ConflictException(`Contract number ${dto.contractNo} is already in use`);
    }

    // Validate optional FKs exist
    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findUnique({ where: { id: dto.opportunityId } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      if (opp.accountId !== dto.accountId) {
        throw new BadRequestException('Opportunity belongs to a different account');
      }
    }
    if (dto.siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: dto.siteId } });
      if (!site) throw new NotFoundException('Site not found');
    }

    const created = await this.prisma.contract.create({
      data: {
        contractNo:                dto.contractNo,
        title:                     dto.title,
        accountId:                 dto.accountId,
        opportunityId:             dto.opportunityId,
        siteId:                    dto.siteId,
        proposalVersionId:         dto.proposalVersionId,
        projectManagerCandidateId: dto.projectManagerCandidateId,
        scopeSummary:              dto.scopeSummary,
        paymentTerms:              dto.paymentTerms,
        retentionPercent:          dto.retentionPercent,
        contractValue:             dto.contractValue,
        currency:                  dto.currency,
        awardedDate:               dto.awardedDate,
        signedDate:                dto.signedDate,
        commencementDate:          dto.commencementDate,
        targetCod:                 dto.targetCod,
        defectsLiabilityMonths:    dto.defectsLiabilityMonths,
        notes:                     dto.notes,
      },
      select: { id: true },
    });

    return this.findById(created.id, user);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateContractDto, user: UserContext): Promise<ContractDetail> {
    const before = await this.findById(id, user); // also enforces scope
    await this.authz.requirePermission(user, 'contract', 'edit', {
      ownerId: before.projectManagerCandidate?.id ?? undefined,
      projectId: before.project?.id ?? undefined,
    });

    // Don't allow contract value edits once handover is completed (commercial freeze)
    if (
      before.handoverStatus === 'COMPLETED' &&
      dto.contractValue !== undefined &&
      Number(dto.contractValue) !== Number(before.contractValue)
    ) {
      throw new ForbiddenException(
        'Contract value cannot be modified after handover is completed',
      );
    }

    await this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.title                  !== undefined && { title: dto.title }),
        ...(dto.siteId                 !== undefined && { siteId: dto.siteId }),
        ...(dto.proposalVersionId      !== undefined && { proposalVersionId: dto.proposalVersionId }),
        ...(dto.projectManagerCandidateId !== undefined && { projectManagerCandidateId: dto.projectManagerCandidateId }),
        ...(dto.scopeSummary           !== undefined && { scopeSummary: dto.scopeSummary }),
        ...(dto.paymentTerms           !== undefined && { paymentTerms: dto.paymentTerms }),
        ...(dto.retentionPercent       !== undefined && { retentionPercent: dto.retentionPercent }),
        ...(dto.contractValue          !== undefined && { contractValue: dto.contractValue }),
        ...(dto.currency               !== undefined && { currency: dto.currency }),
        ...(dto.awardedDate            !== undefined && { awardedDate: dto.awardedDate }),
        ...(dto.signedDate             !== undefined && { signedDate: dto.signedDate }),
        ...(dto.commencementDate       !== undefined && { commencementDate: dto.commencementDate }),
        ...(dto.targetCod              !== undefined && { targetCod: dto.targetCod }),
        ...(dto.defectsLiabilityMonths !== undefined && { defectsLiabilityMonths: dto.defectsLiabilityMonths }),
        ...(dto.notes                  !== undefined && { notes: dto.notes }),
      },
    });

    return this.findById(id, user);
  }

  // ─── Status transition ───────────────────────────────────────────────────

  async transitionStatus(
    id: string,
    dto: TransitionStatusDto,
    user: UserContext,
  ): Promise<ContractDetail> {
    const before = await this.findById(id, user);
    // AWARDED transition requires the 'approve' permission (commercial gate)
    if (dto.toStatus === 'AWARDED') {
      await this.authz.requirePermission(user, 'contract', 'approve');
    } else {
      await this.authz.requirePermission(user, 'contract', 'edit', {
        ownerId: before.projectManagerCandidate?.id ?? undefined,
        projectId: before.project?.id ?? undefined,
      });
    }

    const allowed = STATUS_TRANSITIONS[before.status as ContractStatus];
    if (!allowed.includes(dto.toStatus)) {
      throw new BadRequestException(
        `Cannot transition contract from ${before.status} to ${dto.toStatus}`,
      );
    }

    await this.prisma.contract.update({
      where: { id },
      data: {
        status: dto.toStatus,
        ...(dto.toStatus === 'AWARDED' && !before.awardedDate && { awardedDate: new Date() }),
        ...(dto.toStatus === 'SIGNED'  && !before.signedDate  && { signedDate:  new Date() }),
      },
    });

    this.audit.record({
      actor: user,
      resource: 'contract',
      resourceId: id,
      action: 'status_changed',
      field: 'status',
      oldValue: before.status,
      newValue: dto.toStatus,
      metadata: dto.reason ? { reason: dto.reason } : null,
    }).catch(() => {});

    // Notification — fire-and-forget
    if (dto.toStatus === 'AWARDED') {
      this.sendContractAwardedNotification(id, user).catch(() => {});
    }

    return this.findById(id, user);
  }

  // ─── Handover: start (NOT_STARTED → READY) ───────────────────────────────

  async markHandoverReady(
    id: string,
    dto: StartHandoverDto,
    user: UserContext,
  ): Promise<ContractDetail> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'contract', 'handover', {
      ownerId: before.projectManagerCandidate?.id ?? undefined,
      projectId: before.project?.id ?? undefined,
    });

    if (before.handoverStatus !== 'NOT_STARTED') {
      throw new BadRequestException(`Handover already in state ${before.handoverStatus}`);
    }
    if (!['AWARDED', 'SIGNED', 'ACTIVE'].includes(before.status)) {
      throw new BadRequestException('Contract must be AWARDED before handover can begin');
    }

    // Required fields to mark READY
    const missing = this.requiredHandoverFieldGaps(before);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot mark handover ready — missing required fields: ${missing.join(', ')}`,
      );
    }

    // Build initial checklist (custom or default)
    const initialChecklist: ChecklistItem[] = (dto.checklist ?? DEFAULT_HANDOVER_CHECKLIST).map((c) => ({
      key: c.key,
      label: c.label,
      done: false,
    }));

    await this.prisma.contract.update({
      where: { id },
      data: {
        handoverStatus: 'READY',
        handoverChecklist: initialChecklist as unknown as Prisma.InputJsonValue,
      },
    });

    this.audit.record({
      actor: user,
      resource: 'contract',
      resourceId: id,
      action: 'handover_ready',
      field: 'handoverStatus',
      oldValue: 'NOT_STARTED',
      newValue: 'READY',
      metadata: { checklistItems: initialChecklist.length },
    }).catch(() => {});

    this.sendHandoverReadyNotification(id, user).catch(() => {});

    return this.findById(id, user);
  }

  // ─── Handover: begin (READY → IN_PROGRESS) ───────────────────────────────

  async beginHandover(id: string, user: UserContext): Promise<ContractDetail> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'contract', 'handover', {
      ownerId: before.projectManagerCandidate?.id ?? undefined,
      projectId: before.project?.id ?? undefined,
    });

    if (before.handoverStatus !== 'READY') {
      throw new BadRequestException(`Cannot begin handover from state ${before.handoverStatus}`);
    }

    await this.prisma.contract.update({
      where: { id },
      data: { handoverStatus: 'IN_PROGRESS' },
    });

    this.audit.record({
      actor: user,
      resource: 'contract',
      resourceId: id,
      action: 'handover_started',
      field: 'handoverStatus',
      oldValue: 'READY',
      newValue: 'IN_PROGRESS',
    }).catch(() => {});

    return this.findById(id, user);
  }

  // ─── Checklist item toggle ───────────────────────────────────────────────

  async updateChecklistItem(
    id: string,
    dto: UpdateChecklistItemDto,
    user: UserContext,
  ): Promise<ContractDetail> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'contract', 'handover', {
      ownerId: before.projectManagerCandidate?.id ?? undefined,
      projectId: before.project?.id ?? undefined,
    });

    if (!['READY', 'IN_PROGRESS'].includes(before.handoverStatus)) {
      throw new BadRequestException(
        'Checklist can only be updated while handover is READY or IN_PROGRESS',
      );
    }

    const items = before.handoverChecklist ?? [];
    const idx = items.findIndex((i) => i.key === dto.key);
    if (idx === -1) {
      throw new NotFoundException(`Checklist item "${dto.key}" not found`);
    }

    items[idx] = {
      ...items[idx]!,
      done: dto.done,
      completedAt: dto.done ? new Date().toISOString() : null,
      completedById: dto.done ? user.id : null,
    };

    await this.prisma.contract.update({
      where: { id },
      data: { handoverChecklist: items as unknown as Prisma.InputJsonValue },
    });

    return this.findById(id, user);
  }

  // ─── Handover: complete (IN_PROGRESS → COMPLETED) + project link ─────────

  async completeHandover(
    id: string,
    dto: CompleteHandoverDto,
    user: UserContext,
  ): Promise<ContractDetail> {
    const before = await this.findById(id, user);
    await this.authz.requirePermission(user, 'contract', 'handover', {
      ownerId: before.projectManagerCandidate?.id ?? undefined,
      projectId: before.project?.id ?? undefined,
    });

    if (before.handoverStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(`Cannot complete handover from state ${before.handoverStatus}`);
    }

    // All checklist items must be done
    const incomplete = (before.handoverChecklist ?? []).filter((i) => !i.done);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Cannot complete handover — ${incomplete.length} checklist item(s) still pending: ${incomplete.map((i) => i.label).join(', ')}`,
      );
    }

    // Required: opportunityId + projectManagerCandidateId — used to create/link a project
    if (!before.opportunity?.id) {
      throw new BadRequestException(
        'Cannot complete handover — contract has no linked opportunity (required to create project)',
      );
    }
    // PM can be overridden by the handover caller; otherwise use the contract's candidate.
    const effectivePmId = dto.projectManagerId ?? before.projectManagerCandidate?.id;
    if (!effectivePmId) {
      throw new BadRequestException(
        'Cannot complete handover — provide projectManagerId or set projectManagerCandidate on the contract',
      );
    }
    if (dto.projectManagerId) {
      const u = await this.prisma.user.findUnique({
        where: { id: dto.projectManagerId },
        select: { id: true, isActive: true },
      });
      if (!u || !u.isActive) {
        throw new NotFoundException('Override projectManagerId user not found or inactive');
      }
    }
    if (!before.site?.id) {
      throw new BadRequestException('Cannot complete handover — site must be set');
    }

    // Project linkage strategy:
    //   1. If a project already exists for this opportunity (e.g. created at WON time),
    //      LINK it to the contract by setting project.contractId. Don't create a new one.
    //   2. Otherwise, create a new project via ProjectsService.create(...) using contract context.
    const existingProject = await this.prisma.project.findUnique({
      where: { opportunityId: before.opportunity.id },
      select: { id: true, projectCode: true, projectManagerId: true },
    });

    let projectId: string;
    let projectCode: string;

    if (existingProject) {
      // Already linked via opportunity → just set contractId on project
      await this.prisma.project.update({
        where: { id: existingProject.id },
        data: { contractId: id },
      });
      projectId = existingProject.id;
      projectCode = existingProject.projectCode;
    } else {
      // Need to create. Derive name + code if not provided.
      const projectCodeFinal = dto.projectCode ?? before.contractNo.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
      const projectNameFinal = dto.projectName ?? before.title;

      const created = await this.projectsService.create(
        {
          projectCode:      projectCodeFinal,
          name:             projectNameFinal,
          opportunityId:    before.opportunity.id,
          accountId:        before.account.id,
          siteId:           before.site.id,
          projectManagerId: effectivePmId,
          startDate:        before.commencementDate ?? undefined,
          targetCod:        before.targetCod ?? undefined,
          budgetBaseline:   Number(before.contractValue),
        },
        user,
      );
      projectId = created.id;
      projectCode = (created as { projectCode?: string }).projectCode ?? projectCodeFinal;
      // Link contract to the new project
      await this.prisma.project.update({
        where: { id: projectId },
        data: { contractId: id },
      });
    }

    // Mark handover complete + auto-promote contract to ACTIVE
    await this.prisma.contract.update({
      where: { id },
      data: {
        handoverStatus: 'COMPLETED',
        handoverCompletedAt: new Date(),
        handoverCompletedById: user.id,
        ...(before.status !== 'ACTIVE' && before.status !== 'CLOSED' && { status: 'ACTIVE' }),
      },
    });

    this.audit.record({
      actor: user,
      resource: 'contract',
      resourceId: id,
      action: 'handover_completed',
      field: 'handoverStatus',
      oldValue: 'IN_PROGRESS',
      newValue: 'COMPLETED',
      metadata: {
        projectId,
        projectCode,
        projectManagerId: effectivePmId,
        ...(dto.projectManagerId && dto.projectManagerId !== before.projectManagerCandidate?.id
          ? { pmOverride: true }
          : {}),
      },
    }).catch(() => {});

    this.sendHandoverCompletedNotification(id, projectId, projectCode, user).catch(() => {});

    return this.findById(id, user);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Variance — contractValue vs invoiced vs paid
  // ═════════════════════════════════════════════════════════════════════════

  async getVariance(contractId: string, user: UserContext): Promise<{
    contractValue: number;
    invoicedTotal: number;
    paidTotal: number;
    outstanding: number;
    invoicedPercent: number;
    paidPercent: number;
    currency: string;
    invoiceCount: number;
  }> {
    const contract = await this.findById(contractId, user); // scope check
    const invoices = await this.prisma.invoice.findMany({
      where: { contractId },
      select: { totalAmount: true, paidAmount: true, status: true },
    });

    const cv = Number(contract.contractValue);
    const invoiced = invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
    // Treat PAID as fully paid; PARTIALLY_PAID uses paidAmount; others = 0.
    const paid = invoices.reduce((sum, i) => {
      if (i.status === 'PAID') return sum + Number(i.totalAmount);
      if (i.paidAmount) return sum + Number(i.paidAmount);
      return sum;
    }, 0);

    return {
      contractValue: cv,
      invoicedTotal: invoiced,
      paidTotal: paid,
      outstanding: Math.max(0, cv - paid),
      invoicedPercent: cv > 0 ? Math.round((invoiced / cv) * 1000) / 10 : 0,
      paidPercent: cv > 0 ? Math.round((paid / cv) * 1000) / 10 : 0,
      currency: contract.currency,
      invoiceCount: invoices.length,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Contract milestones (children of a contract)
  // ═════════════════════════════════════════════════════════════════════════

  async listMilestones(contractId: string, user: UserContext) {
    await this.findById(contractId, user); // scope check
    return this.prisma.contractMilestone.findMany({
      where: { contractId },
      orderBy: { milestoneNo: 'asc' },
    });
  }

  async createMilestone(
    contractId: string,
    dto: CreateContractMilestoneDto,
    user: UserContext,
  ) {
    await this.findById(contractId, user);
    await this.authz.requirePermission(user, 'invoice_milestone', 'create');

    const dup = await this.prisma.contractMilestone.findFirst({
      where: { contractId, milestoneNo: dto.milestoneNo },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `Milestone #${dto.milestoneNo} already exists on this contract`,
      );
    }

    return this.prisma.contractMilestone.create({
      data: {
        contractId,
        milestoneNo:      dto.milestoneNo,
        title:            dto.title,
        description:      dto.description,
        percentValue:     dto.percentValue,
        amount:           dto.amount,
        triggerCondition: dto.triggerCondition,
        targetDate:       dto.targetDate,
      },
    });
  }

  async updateMilestone(
    contractId: string,
    milestoneId: string,
    dto: UpdateContractMilestoneDto,
    user: UserContext,
  ) {
    await this.findById(contractId, user);
    await this.authz.requirePermission(user, 'invoice_milestone', 'edit');

    const existing = await this.prisma.contractMilestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, contractId: true, isAchieved: true, achievedDate: true },
    });
    if (!existing || existing.contractId !== contractId) {
      throw new NotFoundException('Milestone not found');
    }

    // If toggling isAchieved → true, stamp achievedDate (unless caller passed one)
    const willAchieve = dto.isAchieved === true && !existing.isAchieved;
    const willUnachieve = dto.isAchieved === false && existing.isAchieved;

    return this.prisma.contractMilestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.title            !== undefined && { title:            dto.title }),
        ...(dto.description      !== undefined && { description:      dto.description }),
        ...(dto.percentValue     !== undefined && { percentValue:     dto.percentValue }),
        ...(dto.amount           !== undefined && { amount:           dto.amount }),
        ...(dto.triggerCondition !== undefined && { triggerCondition: dto.triggerCondition }),
        ...(dto.targetDate       !== undefined && { targetDate:       dto.targetDate }),
        ...(dto.achievedDate     !== undefined && { achievedDate:     dto.achievedDate }),
        ...(dto.isAchieved       !== undefined && { isAchieved:       dto.isAchieved }),
        ...(willAchieve   && !dto.achievedDate && { achievedDate: new Date() }),
        ...(willUnachieve && !dto.achievedDate && { achievedDate: null }),
      },
    });
  }

  async deleteMilestone(
    contractId: string,
    milestoneId: string,
    user: UserContext,
  ): Promise<void> {
    await this.findById(contractId, user);
    await this.authz.requirePermission(user, 'invoice_milestone', 'edit');

    const existing = await this.prisma.contractMilestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, contractId: true, isAchieved: true, invoiceId: true },
    });
    if (!existing || existing.contractId !== contractId) {
      throw new NotFoundException('Milestone not found');
    }
    if (existing.isAchieved || existing.invoiceId) {
      throw new BadRequestException(
        'Cannot delete an achieved or invoiced milestone',
      );
    }
    await this.prisma.contractMilestone.delete({ where: { id: milestoneId } });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Invoices (children of a contract)
  // ═════════════════════════════════════════════════════════════════════════

  async listInvoices(contractId: string, user: UserContext) {
    await this.findById(contractId, user);
    return this.prisma.invoice.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(
    contractId: string,
    dto: CreateInvoiceDto,
    user: UserContext,
  ) {
    await this.findById(contractId, user);
    await this.authz.requirePermission(user, 'invoice_milestone', 'create');

    // Unique check on invoiceNo
    const dup = await this.prisma.invoice.findUnique({
      where: { invoiceNo: dto.invoiceNo },
      select: { id: true },
    });
    if (dup) throw new ConflictException(`Invoice number ${dto.invoiceNo} already exists`);

    if (dto.milestoneId) {
      const m = await this.prisma.contractMilestone.findUnique({
        where: { id: dto.milestoneId },
        select: { id: true, contractId: true },
      });
      if (!m || m.contractId !== contractId) {
        throw new BadRequestException('Milestone does not belong to this contract');
      }
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNo:    dto.invoiceNo,
        contractId,
        milestoneId:  dto.milestoneId,
        amount:       dto.amount,
        taxAmount:    dto.taxAmount,
        totalAmount:  dto.totalAmount,
        currency:     dto.currency,
        invoiceDate:  dto.invoiceDate,
        dueDate:      dto.dueDate,
        notes:        dto.notes,
      },
    });

    // If linked to a milestone, set the milestone's invoiceId for traceability
    if (dto.milestoneId) {
      await this.prisma.contractMilestone.update({
        where: { id: dto.milestoneId },
        data: { invoiceId: invoice.id },
      });
    }

    return invoice;
  }

  async updateInvoiceStatus(
    contractId: string,
    invoiceId: string,
    dto: UpdateInvoiceStatusDto,
    user: UserContext,
  ) {
    await this.findById(contractId, user);
    await this.authz.requirePermission(user, 'invoice_milestone', 'edit');

    const existing = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, contractId: true, status: true, totalAmount: true },
    });
    if (!existing || existing.contractId !== contractId) {
      throw new NotFoundException('Invoice not found');
    }

    // Auto-stamp paidDate when fully PAID and not already set
    const becomingPaid = dto.status === 'PAID';
    const becomingPartial = dto.status === 'PARTIALLY_PAID';

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: dto.status,
        ...(dto.paidAmount !== undefined && { paidAmount: dto.paidAmount }),
        ...(dto.notes      !== undefined && { notes:      dto.notes }),
        ...(becomingPaid && !dto.paidDate && { paidDate: new Date(), paidAmount: dto.paidAmount ?? Number(existing.totalAmount) }),
        ...(dto.paidDate !== undefined && { paidDate: dto.paidDate }),
        ...(becomingPartial && dto.paidAmount === undefined && {}),
      },
      select: {
        id: true,
        invoiceNo: true,
        totalAmount: true,
        currency: true,
      },
    });

    // Audit trail
    if (existing.status !== dto.status) {
      this.audit.record({
        actor: user,
        resource: 'invoice',
        resourceId: invoiceId,
        action: 'status_changed',
        field: 'status',
        oldValue: existing.status,
        newValue: dto.status,
        metadata: {
          contractId,
          invoiceNo: updated.invoiceNo,
          ...(dto.paidAmount !== undefined && { paidAmount: dto.paidAmount }),
        },
      }).catch(() => {});
    }

    // Notify finance on PAID transition (cash-cycle visibility)
    if (becomingPaid && existing.status !== 'PAID') {
      this.sendInvoicePaidNotification(contractId, updated, user).catch(() => {});
    }

    return updated;
  }

  // ─── Invoice paid notification ──────────────────────────────────────────

  private async sendInvoicePaidNotification(
    contractId: string,
    invoice: { id: string; invoiceNo: string; totalAmount: unknown; currency: string },
    actor: UserContext,
  ): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        contractNo: true,
        title: true,
        project: { select: { id: true, projectManagerId: true } },
      },
    });
    if (!contract) return;

    const recipients = new Set<string>();
    const financeIds = await this.notifications.getUserIdsByRoles(['DIRECTOR', 'FINANCE_ADMIN']);
    financeIds.forEach((id) => recipients.add(id));
    if (contract.project?.projectManagerId) recipients.add(contract.project.projectManagerId);
    recipients.delete(actor.id);
    if (recipients.size === 0) return;

    const linkUrl = contract.project?.id
      ? `/projects/${contract.project.id}`
      : `/contracts/${contractId}`;

    await this.notifications.createMany(
      Array.from(recipients).map((userId) => ({
        userId,
        title: `Invoice paid: ${invoice.invoiceNo} — ${contract.contractNo}`,
        body: `${contract.title} · ${invoice.currency} ${Number(invoice.totalAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} received.`,
        type: 'invoice_paid',
        linkUrl,
        resource: 'invoice',
        resourceId: invoice.id,
      })),
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═════════════════════════════════════════════════════════════════════════

  /** Coerces stored JSON checklist into typed items (defensive). */
  private normaliseChecklist(raw: unknown): ChecklistItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => ({
        key: String(x.key ?? ''),
        label: String(x.label ?? ''),
        done: Boolean(x.done),
        completedAt: typeof x.completedAt === 'string' ? x.completedAt : null,
        completedById: typeof x.completedById === 'string' ? x.completedById : null,
      }))
      .filter((x) => x.key && x.label);
  }

  /** Returns the human labels of any missing required-for-READY fields. */
  private requiredHandoverFieldGaps(c: ContractDetail): string[] {
    const gaps: string[] = [];
    if (!c.opportunity?.id)             gaps.push('linked opportunity');
    if (!c.site?.id)                    gaps.push('linked site');
    if (!c.projectManagerCandidate?.id) gaps.push('project manager candidate');
    if (!c.awardedDate)                 gaps.push('awarded date');
    if (!c.targetCod)                   gaps.push('target COD');
    if (Number(c.contractValue) <= 0)   gaps.push('contract value');
    return gaps;
  }

  // ─── Notification dispatchers ────────────────────────────────────────────

  private async sendContractAwardedNotification(
    contractId: string,
    actor: UserContext,
  ): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        contractNo: true,
        title: true,
        projectManagerCandidateId: true,
        account: { select: { name: true } },
      },
    });
    if (!contract) return;

    const recipients = new Set<string>();
    const directorIds = await this.notifications.getUserIdsByRoles([
      'DIRECTOR',
      'PMO_MANAGER',
      'FINANCE_ADMIN',
    ]);
    directorIds.forEach((id) => recipients.add(id));
    if (contract.projectManagerCandidateId) recipients.add(contract.projectManagerCandidateId);
    recipients.delete(actor.id);
    if (recipients.size === 0) return;

    await this.notifications.createMany(
      Array.from(recipients).map((userId) => ({
        userId,
        title: `Contract awarded: ${contract.contractNo}`,
        body: `${contract.account.name} · ${contract.title}`,
        type: 'contract_awarded',
        linkUrl: `/contracts/${contractId}`,
        resource: 'contract',
        resourceId: contractId,
      })),
    );
  }

  private async sendHandoverReadyNotification(
    contractId: string,
    actor: UserContext,
  ): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        contractNo: true,
        title: true,
        projectManagerCandidateId: true,
      },
    });
    if (!contract) return;

    const recipients = new Set<string>();
    const pmoIds = await this.notifications.getUserIdsByRoles(['PMO_MANAGER', 'DIRECTOR']);
    pmoIds.forEach((id) => recipients.add(id));
    if (contract.projectManagerCandidateId) recipients.add(contract.projectManagerCandidateId);
    recipients.delete(actor.id);
    if (recipients.size === 0) return;

    await this.notifications.createMany(
      Array.from(recipients).map((userId) => ({
        userId,
        title: `Handover ready: ${contract.contractNo}`,
        body: `${contract.title} is ready for handover. Begin the handover checklist when ready.`,
        type: 'contract_handover_ready',
        linkUrl: `/contracts/${contractId}`,
        resource: 'contract',
        resourceId: contractId,
      })),
    );
  }

  private async sendHandoverCompletedNotification(
    contractId: string,
    projectId: string,
    projectCode: string,
    actor: UserContext,
  ): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        contractNo: true,
        title: true,
        projectManagerCandidateId: true,
      },
    });
    if (!contract) return;

    const recipients = new Set<string>();
    const leaderIds = await this.notifications.getUserIdsByRoles([
      'DIRECTOR',
      'PMO_MANAGER',
      'FINANCE_ADMIN',
    ]);
    leaderIds.forEach((id) => recipients.add(id));
    if (contract.projectManagerCandidateId) recipients.add(contract.projectManagerCandidateId);
    recipients.delete(actor.id);
    if (recipients.size === 0) return;

    await this.notifications.createMany(
      Array.from(recipients).map((userId) => ({
        userId,
        title: `Handover completed: ${contract.contractNo} → ${projectCode}`,
        body: `${contract.title} has been handed over and the project is now active.`,
        type: 'contract_handover_completed',
        linkUrl: `/projects/${projectId}`,
        resource: 'contract',
        resourceId: contractId,
      })),
    );
  }
}
