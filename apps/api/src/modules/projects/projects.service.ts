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
import { UserContext, PaginatedResult } from '@solaroo/types';
import { Prisma } from '@solaroo/db';
import { GATE_TEMPLATES, formatProjectNumber } from '@solaroo/workflows';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectQueryDto,
  UpdateGateStatusDto,
  UpdateDeliverableDto,
  AddProjectMemberDto,
} from './projects.dto';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ProjectListItem = {
  id: string;
  projectNumber: number;
  projectCode: string;
  name: string;
  status: string;
  currentGateNo: number;
  ragStatus: string;
  currentBlocker: string | null;
  blockerDueDate: Date | null;
  startDate: Date | null;
  targetCod: Date | null;
  budgetBaseline: unknown;
  createdAt: Date;
  account: { id: string; name: string };
  projectManager: { id: string; name: string };
  _count: { gates: number; issues: number };
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(
    query: ProjectQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<ProjectListItem>> {
    const { search, status, accountId, page, pageSize, sortBy, sortDir } = query;

    const scope = await this.authz.getBestScope(user, 'project', 'view');
    if (!scope) throw new ForbiddenException('No permission to view projects');

    const scopeFilter: Prisma.ProjectWhereInput =
      scope === 'assigned'
        ? {
            OR: [
              { projectManagerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }
        : {};

    const canViewCost = await this.authz.hasPermission(user, 'cost', 'view');

    const andFilters: Prisma.ProjectWhereInput[] = [scopeFilter];
    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { projectCode: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ProjectWhereInput = {
      AND: andFilters,
      ...(status && { status }),
      ...(accountId && { accountId }),
    };

    const [total, items] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          projectNumber: true,
          projectCode: true,
          name: true,
          status: true,
          currentGateNo: true,
          ragStatus: true,
          currentBlocker: true,
          blockerDueDate: true,
          startDate: true,
          targetCod: true,
          budgetBaseline: true,
          createdAt: true,
          account: { select: { id: true, name: true } },
          projectManager: { select: { id: true, name: true } },
          _count: { select: { gates: true, issues: true } },
        },
      }),
    ]);

    const mappedItems = (items as unknown as ProjectListItem[]).map((item) => ({
      ...item,
      budgetBaseline: canViewCost ? item.budgetBaseline : undefined,
    }));

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, name: true, accountCode: true } },
        site: { select: { id: true, name: true, address: true } },
        projectManager: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        contract: { select: { id: true, contractNo: true, title: true, status: true, handoverStatus: true } },
        blockerOwner: { select: { id: true, name: true } },
        gates: {
          orderBy: { gateNo: 'asc' },
          include: {
            deliverables: { orderBy: { sortOrder: 'asc' } },
            owner: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            issues: true,
            risks: true,
            milestones: true,
            variations: true,
            punchlistItems: true,
          },
        },
      },
    });

    if (!project) throw new NotFoundException(`Project ${id} not found`);

    await this.authz.requirePermission(user, 'project', 'view', {
      ownerId:   project.projectManagerId,
      projectId: id,
    });

    const canViewCost = await this.authz.hasPermission(user, 'cost', 'view');
    if (!canViewCost) {
      const p = project as Record<string, unknown>;
      delete p['budgetBaseline'];
      delete p['actualCostToDate'];
      delete p['marginBaseline'];
    }

    return project;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto, user: UserContext) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: dto.opportunityId },
      include: { project: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (opportunity.project) {
      throw new ConflictException('This opportunity already has a project');
    }

    const codeExists = await this.prisma.project.findUnique({
      where: { projectCode: dto.projectCode },
    });
    if (codeExists) {
      throw new ConflictException(`Project code ${dto.projectCode} is already in use`);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          projectCode:       dto.projectCode,
          name:              dto.name,
          opportunityId:     dto.opportunityId,
          accountId:         dto.accountId,
          siteId:            dto.siteId,
          projectManagerId:  dto.projectManagerId,
          designLeadId:      dto.designLeadId ?? null,
          procurementLeadId: dto.procurementLeadId ?? null,
          startDate:         dto.startDate ?? null,
          targetCod:         dto.targetCod ?? null,
          budgetBaseline:    dto.budgetBaseline ?? null,
          notes:             dto.notes ?? null,
          currentGateNo:     1,
        },
      });

      for (const gateTemplate of GATE_TEMPLATES) {
        const gate = await tx.projectGate.create({
          data: {
            projectId:   created.id,
            gateNo:      gateTemplate.gateNo,
            gateName:    gateTemplate.gateName,
            ownerUserId: dto.projectManagerId,
            status:      gateTemplate.gateNo === 1 ? 'IN_PROGRESS' : 'NOT_STARTED',
          },
        });

        await tx.gateDeliverable.createMany({
          data: gateTemplate.deliverables.map((d) => ({
            gateId:      gate.id,
            code:        d.code,
            name:        d.name,
            description: d.description,
            isRequired:  d.isRequired,
            sortOrder:   d.sortOrder,
          })),
        });
      }

      return created;
    });

    return this.findById(project.id, user);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProjectDto, user: UserContext) {
    await this.findById(id, user);

    const privilegedRoles = new Set(['DIRECTOR', 'PMO_MANAGER', 'PROJECT_MANAGER']);
    const isPrivileged = privilegedRoles.has(user.roleName);

    if (!isPrivileged) {
      const restrictedFields: (keyof UpdateProjectDto)[] = [
        'projectManagerId',
        'designLeadId',
        'procurementLeadId',
        'budgetBaseline',
        'budgetUpdated',
        'status',
        'pmoStatusNote',
        'lastPmoReviewAt',
      ];

      const attempted = restrictedFields.filter((f) => f in dto && dto[f] !== undefined);
      if (attempted.length > 0) {
        throw new ForbiddenException(
          `Your role (${user.roleName}) is not permitted to modify: ${attempted.join(', ')}`,
        );
      }
    }

    // Capture pre-update blocker state to detect owner changes
    const before = await this.prisma.project.findUnique({
      where: { id },
      select: { blockerOwnerId: true, currentBlocker: true },
    });

    await this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        designLeadId:      dto.designLeadId === null ? null : dto.designLeadId,
        procurementLeadId: dto.procurementLeadId === null ? null : dto.procurementLeadId,
      },
    });

    // Notification + audit — blocker owner assigned (or changed to a new user)
    if (
      dto.blockerOwnerId !== undefined &&
      dto.blockerOwnerId !== null &&
      dto.blockerOwnerId !== before?.blockerOwnerId
    ) {
      this.audit.record({
        actor: user,
        resource: 'project',
        resourceId: id,
        action: 'blocker_owner_assigned',
        field: 'blockerOwnerId',
        oldValue: before?.blockerOwnerId ?? null,
        newValue: dto.blockerOwnerId,
        metadata: {
          blocker: dto.currentBlocker ?? before?.currentBlocker ?? null,
          dueDate: dto.blockerDueDate ? String(dto.blockerDueDate) : null,
        },
      }).catch(() => {});

      this.sendBlockerAssignedNotification(
        id,
        dto.blockerOwnerId,
        dto.currentBlocker ?? before?.currentBlocker ?? null,
        dto.blockerDueDate ?? null,
        user,
      ).catch(() => {});
    }

    return this.findById(id, user);
  }

  // ─── Blocker assignment notification ──────────────────────────────────────

  private async sendBlockerAssignedNotification(
    projectId: string,
    newOwnerId: string,
    blocker: string | null,
    dueDate: Date | null,
    actor: UserContext,
  ): Promise<void> {
    if (newOwnerId === actor.id) return; // no self-notify
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectCode: true, name: true },
    });
    if (!project) return;
    const dueText = dueDate ? ` — due ${new Date(dueDate).toISOString().slice(0, 10)}` : '';
    const blockerText = blocker?.trim() || '(no description)';
    await this.notifications.create({
      userId: newOwnerId,
      title: `You've been assigned a blocker on ${project.projectCode}`,
      body: `${project.name} · ${blockerText}${dueText}`,
      type: 'blocker_assigned',
      linkUrl: `/projects/${projectId}`,
      resource: 'project',
      resourceId: projectId,
    });
  }

  // ─── Gate status update ────────────────────────────────────────────────────

  async updateGateStatus(
    projectId: string,
    gateNo: number,
    dto: UpdateGateStatusDto,
    user: UserContext,
  ) {
    const gate = await this.prisma.projectGate.findUnique({
      where: { projectId_gateNo: { projectId, gateNo } },
      include: { deliverables: true },
    });
    if (!gate) throw new NotFoundException(`Gate ${gateNo} not found on project`);

    const gateScopeCtx = { ownerId: gate.ownerUserId, projectId };
    if (dto.status === 'APPROVED') {
      await this.authz.requirePermission(user, 'project_gate', 'approve', gateScopeCtx);
    } else if (dto.status === 'SUBMITTED') {
      await this.authz.requirePermission(user, 'project_gate', 'submit', gateScopeCtx);
    } else {
      await this.authz.requirePermission(user, 'project_gate', 'edit', gateScopeCtx);
    }

    if (dto.status === 'APPROVED') {
      const blockers = gate.deliverables.filter(
        (d) => d.isRequired && !['UPLOADED', 'SUBMITTED', 'APPROVED', 'NOT_REQUIRED'].includes(d.status),
      );
      if (blockers.length > 0) {
        throw new BadRequestException(
          `Cannot approve gate — ${blockers.length} required deliverable(s) still pending: ${blockers.map((d) => d.code).join(', ')}`,
        );
      }
    }

    const updateData: Prisma.ProjectGateUpdateInput = {
      status:  dto.status,
      remarks: dto.remarks ?? gate.remarks,
      ...(dto.targetDate && { targetDate: dto.targetDate }),
      ...(dto.status === 'APPROVED' && {
        approvedBy: user.id,
        approvedAt: new Date(),
        actualDate: new Date(),
      }),
      ...(dto.status === 'REJECTED' && {
        rejectedBy: user.id,
        rejectedAt: new Date(),
      }),
      ...(dto.pmoFlagged !== undefined && { pmoFlagged: dto.pmoFlagged }),
      ...(dto.pmoComment !== undefined && { pmoComment: dto.pmoComment }),
      ...(dto.pmoReviewAt !== undefined && { pmoReviewAt: dto.pmoReviewAt }),
    };

    await this.prisma.projectGate.update({
      where: { projectId_gateNo: { projectId, gateNo } },
      data: updateData,
    });

    if (dto.status === 'APPROVED' && gateNo < 6) {
      const nextGateNo = gateNo + 1;
      await Promise.all([
        this.prisma.project.update({
          where: { id: projectId },
          data: { currentGateNo: nextGateNo },
        }),
        this.prisma.projectGate.update({
          where: { projectId_gateNo: { projectId, gateNo: nextGateNo } },
          data: { status: 'IN_PROGRESS' },
        }),
      ]);
    }

    // ── Audit + Notifications ────────────────────────────────────────────────
    // Fire-and-forget: don't let trail/notification failures break the gate update
    this.audit.record({
      actor: user,
      resource: 'project_gate',
      resourceId: `${projectId}:${gateNo}`,
      action: 'status_changed',
      field: 'status',
      oldValue: gate.status,
      newValue: dto.status,
      metadata: {
        projectId,
        gateNo,
        gateName: gate.gateName,
        ...(dto.remarks && { remarks: dto.remarks }),
      },
    }).catch(() => {});

    this.sendGateNotifications(projectId, gateNo, gate.gateName, dto.status, user).catch(() => {});

    return this.findById(projectId, user);
  }

  // ─── Gate notification dispatcher ─────────────────────────────────────────

  private async sendGateNotifications(
    projectId: string,
    gateNo: number,
    gateName: string,
    newStatus: string,
    actor: UserContext,
  ): Promise<void> {
    // Fetch project info for notification context
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        projectCode: true,
        name: true,
        projectManagerId: true,
        members: { select: { userId: true } },
      },
    });
    if (!project) return;

    const linkUrl = `/projects/${projectId}`;
    const gateLabel = `G${gateNo}: ${gateName}`;

    if (newStatus === 'SUBMITTED') {
      // Notify all DIRECTOR + PMO_MANAGER users (the gate approvers)
      const approverIds = await this.notifications.getUserIdsByRoles(['DIRECTOR', 'PMO_MANAGER']);
      // Also notify the project PM if they differ from the actor (PM submitting notifies others)
      if (project.projectManagerId !== actor.id) {
        approverIds.push(project.projectManagerId);
      }
      const uniqueIds = [...new Set(approverIds.filter((id) => id !== actor.id))];
      await this.notifications.createMany(
        uniqueIds.map((userId) => ({
          userId,
          title: `Gate review required: ${gateLabel} — ${project.projectCode}`,
          body: `${project.name} · Gate ${gateNo} has been submitted for approval.`,
          type: 'gate_submitted',
          linkUrl,
          resource: 'project_gate',
          resourceId: projectId,
        })),
      );
    } else if (newStatus === 'APPROVED') {
      // Notify PM + project team members
      const memberIds = project.members.map((m) => m.userId);
      const recipientIds = [
        ...new Set([project.projectManagerId, ...memberIds].filter((id) => id !== actor.id)),
      ];
      const nextMsg = gateNo < 6 ? ` Gate ${gateNo + 1} is now open.` : ' Project execution is complete.';
      await this.notifications.createMany(
        recipientIds.map((userId) => ({
          userId,
          title: `Gate approved: ${gateLabel} — ${project.projectCode}`,
          body: `${project.name} · ${gateLabel} has been approved.${nextMsg}`,
          type: 'gate_approved',
          linkUrl,
          resource: 'project_gate',
          resourceId: projectId,
        })),
      );
    } else if (newStatus === 'REJECTED') {
      // Notify PM + project team members to action the rejection
      const memberIds = project.members.map((m) => m.userId);
      const recipientIds = [
        ...new Set([project.projectManagerId, ...memberIds].filter((id) => id !== actor.id)),
      ];
      await this.notifications.createMany(
        recipientIds.map((userId) => ({
          userId,
          title: `Gate rejected: ${gateLabel} — ${project.projectCode}`,
          body: `${project.name} · ${gateLabel} was rejected. Please review feedback and re-submit.`,
          type: 'gate_rejected',
          linkUrl,
          resource: 'project_gate',
          resourceId: projectId,
        })),
      );
    }
  }

  // ─── Deliverable update ────────────────────────────────────────────────────

  async updateDeliverable(
    projectId: string,
    deliverableId: string,
    dto: UpdateDeliverableDto,
    user: UserContext,
  ) {
    const deliverable = await this.prisma.gateDeliverable.findUnique({
      where: { id: deliverableId },
      include: { gate: true },
    });

    if (!deliverable || deliverable.gate.projectId !== projectId) {
      throw new NotFoundException('Deliverable not found');
    }

    const gateScopeCtx = { ownerId: deliverable.gate.ownerUserId, projectId };
    if (dto.status === 'APPROVED') {
      await this.authz.requirePermission(user, 'project_gate', 'approve', gateScopeCtx);
    } else if (dto.status === 'SUBMITTED') {
      await this.authz.requirePermission(user, 'project_gate', 'submit', gateScopeCtx);
    } else {
      await this.authz.requirePermission(user, 'project_gate', 'edit', gateScopeCtx);
    }

    await this.prisma.gateDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: dto.status,
        notes:  dto.notes ?? deliverable.notes,
        ...(dto.status === 'SUBMITTED' && !deliverable.submittedAt && {
          submittedAt: new Date(),
        }),
        ...(dto.status === 'APPROVED' && !deliverable.approvedAt && {
          approvedAt:   new Date(),
          approvedById: user.id,
        }),
      },
    });

    // Audit + notification (status change)
    this.audit.record({
      actor: user,
      resource: 'gate_deliverable',
      resourceId: deliverableId,
      action: 'status_changed',
      field: 'status',
      oldValue: deliverable.status,
      newValue: dto.status,
      metadata: {
        projectId,
        gateId: deliverable.gateId,
        code: deliverable.code,
        name: deliverable.name,
      },
    }).catch(() => {});

    if (dto.status === 'APPROVED') {
      this.sendDeliverableApprovedNotification(
        projectId,
        deliverable.code,
        deliverable.name,
        user,
      ).catch(() => {});
    }

    return this.findById(projectId, user);
  }

  // ─── Deliverable approval notification ────────────────────────────────────

  private async sendDeliverableApprovedNotification(
    projectId: string,
    code: string,
    name: string,
    actor: UserContext,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        projectCode: true,
        name: true,
        projectManagerId: true,
        members: { select: { userId: true } },
      },
    });
    if (!project) return;
    const recipientIds = [
      ...new Set([
        project.projectManagerId,
        ...project.members.map((m) => m.userId),
      ].filter((id) => id !== actor.id)),
    ];
    if (recipientIds.length === 0) return;
    await this.notifications.createMany(
      recipientIds.map((userId) => ({
        userId,
        title: `Deliverable approved: ${code} — ${project.projectCode}`,
        body: `${project.name} · ${name} has been approved.`,
        type: 'deliverable_approved',
        linkUrl: `/projects/${projectId}`,
        resource: 'gate_deliverable',
        resourceId: projectId,
      })),
    );
  }

  // ─── Project members ──────────────────────────────────────────────────────

  async addMember(
    projectId: string,
    dto: AddProjectMemberDto,
    user: UserContext,
  ) {
    // Verify project exists and caller can see it (also enforces scope)
    const project = await this.findById(projectId, user);
    await this.authz.requirePermission(user, 'project', 'manage_members', {
      ownerId: project.projectManagerId,
      projectId,
    });

    // Verify the target user exists and is active
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, isActive: true, name: true },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    // Idempotent — upsert on the composite key
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      create: { projectId, userId: dto.userId, memberRole: dto.memberRole },
      update: { memberRole: dto.memberRole },
    });

    // Audit + notification
    this.audit.record({
      actor: user,
      resource: 'project',
      resourceId: projectId,
      action: 'member_added',
      metadata: { userId: dto.userId, memberRole: dto.memberRole, name: target.name },
    }).catch(() => {});

    this.sendMemberAddedNotification(projectId, dto.userId, dto.memberRole, user).catch(() => {});

    return this.findById(projectId, user);
  }

  async removeMember(
    projectId: string,
    userId: string,
    user: UserContext,
  ) {
    const project = await this.findById(projectId, user);
    await this.authz.requirePermission(user, 'project', 'manage_members', {
      ownerId: project.projectManagerId,
      projectId,
    });

    await this.prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    this.audit.record({
      actor: user,
      resource: 'project',
      resourceId: projectId,
      action: 'member_removed',
      metadata: { userId },
    }).catch(() => {});

    return this.findById(projectId, user);
  }

  // ─── Project member added notification ────────────────────────────────────

  private async sendMemberAddedNotification(
    projectId: string,
    newMemberId: string,
    memberRole: string,
    actor: UserContext,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectCode: true, name: true, projectManagerId: true },
    });
    if (!project) return;

    const linkUrl = `/projects/${projectId}`;
    const payloads: {
      userId: string;
      title: string;
      body?: string;
      type: string;
      linkUrl?: string;
      resource?: string;
      resourceId?: string;
    }[] = [];

    // Welcome the new member (skip if they added themselves)
    if (newMemberId !== actor.id) {
      payloads.push({
        userId: newMemberId,
        title: `You've been added to ${project.projectCode}`,
        body: `${project.name} — your role: ${memberRole}`,
        type: 'project_member_added',
        linkUrl,
        resource: 'project',
        resourceId: projectId,
      });
    }

    // Inform the PM (skip if PM is the actor or the new member)
    if (
      project.projectManagerId !== actor.id &&
      project.projectManagerId !== newMemberId
    ) {
      payloads.push({
        userId: project.projectManagerId,
        title: `Member added to ${project.projectCode}`,
        body: `${project.name} — a new member was added with role ${memberRole}.`,
        type: 'project_member_added',
        linkUrl,
        resource: 'project',
        resourceId: projectId,
      });
    }

    if (payloads.length > 0) {
      await this.notifications.createMany(payloads);
    }
  }

  // ─── Project summary by number ─────────────────────────────────────────────

  async findByNumber(projectNumber: number, user: UserContext) {
    const project = await this.prisma.project.findUnique({
      where: { projectNumber },
    });
    if (!project) throw new NotFoundException(`Project P${String(projectNumber).padStart(3, '0')} not found`);
    return this.findById(project.id, user);
  }

  formatNumber(n: number): string {
    return formatProjectNumber(n);
  }
}
