import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext } from '@solaroo/types';

// ─── Response Types ────────────────────────────────────────────────────────────

export type OpportunityByStage = { stage: string; count: number; totalValue: number };

export type PipelineMetrics = {
  totalActiveOpportunities: number;
  totalPipelineValue: number;           // sum of estimatedValue on non-closed opps
  overdueNextActions: number;           // nextActionDueDate < now
  staleOpportunities: number;           // no updatedAt change in 30+ days AND not WON/LOST
  byStage: OpportunityByStage[];
};

export type ProposalMetrics = {
  totalProposals: number;
  pendingApproval: number;              // SUBMITTED + UNDER_REVIEW versions
  approved: number;
  rejected: number;
  oldestPendingDays: number | null;     // age in days of oldest pending version
};

export type RagBreakdown = { GREEN: number; AMBER: number; RED: number };

export type RedProject = {
  id: string;
  projectCode: string;
  name: string;
  currentBlocker: string | null;
  blockerDueDate: Date | null;
  blockerOwner: { id: string; name: string } | null;
  projectManager: { id: string; name: string };
};

export type ProjectMetrics = {
  totalActive: number;
  ragBreakdown: RagBreakdown;
  redProjects: RedProject[];
  overdueGateDeliverables: number;      // PENDING required deliverables on approved-or-in-progress gates
};

export type QuickCounts = {
  activeAccounts: number;
  activeOpportunities: number;
  activeProjects: number;
  proposalsPendingApproval: number;
};

export type DashboardMetrics = {
  pipeline: PipelineMetrics;
  proposals: ProposalMetrics;
  projects: ProjectMetrics;
  quickCounts: QuickCounts;
  generatedAt: string;
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(_user: UserContext): Promise<DashboardMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all independent queries in parallel for speed
    const [
      // Pipeline
      opportunityAggregates,
      overdueNextActions,
      staleOpportunities,
      opportunitiesByStage,

      // Proposals
      totalProposals,
      pendingVersions,
      approvedVersions,
      rejectedVersions,
      oldestPending,

      // Projects
      activeProjects,
      ragCounts,
      redProjects,
      overdueDeliverables,

      // Quick counts
      activeAccounts,
    ] = await Promise.all([
      // ── Pipeline ─────────────────────────────────────────────────────────
      this.prisma.opportunity.aggregate({
        where: { stage: { notIn: ['WON', 'LOST'] } },
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),

      this.prisma.opportunity.count({
        where: {
          stage: { notIn: ['WON', 'LOST'] },
          nextActionDueDate: { lt: now },
        },
      }),

      this.prisma.opportunity.count({
        where: {
          stage: { notIn: ['WON', 'LOST'] },
          updatedAt: { lt: thirtyDaysAgo },
        },
      }),

      this.prisma.opportunity.groupBy({
        by: ['stage'],
        where: { stage: { notIn: ['WON', 'LOST'] } },
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),

      // ── Proposals ────────────────────────────────────────────────────────
      this.prisma.proposal.count(),

      this.prisma.proposalVersion.count({
        where: { approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),

      this.prisma.proposalVersion.count({
        where: { approvalStatus: 'APPROVED' },
      }),

      this.prisma.proposalVersion.count({
        where: { approvalStatus: 'REJECTED' },
      }),

      this.prisma.proposalVersion.findFirst({
        where: { approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        orderBy: { submittedForApprovalAt: 'asc' },
        select: { submittedForApprovalAt: true },
      }),

      // ── Projects ──────────────────────────────────────────────────────────
      this.prisma.project.count({
        where: { status: 'ACTIVE' },
      }),

      this.prisma.project.groupBy({
        by: ['ragStatus'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),

      this.prisma.project.findMany({
        where: { status: 'ACTIVE', ragStatus: 'RED' },
        select: {
          id: true,
          projectCode: true,
          name: true,
          currentBlocker: true,
          blockerDueDate: true,
          blockerOwner: { select: { id: true, name: true } },
          projectManager: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'asc' },
      }),

      // Overdue = required deliverables still PENDING on gates that are IN_PROGRESS or SUBMITTED
      this.prisma.gateDeliverable.count({
        where: {
          isRequired: true,
          status: 'PENDING',
          gate: {
            status: { in: ['IN_PROGRESS', 'SUBMITTED'] },
            project: { status: 'ACTIVE' },
          },
        },
      }),

      // ── Quick counts ──────────────────────────────────────────────────────
      this.prisma.account.count({
        where: { isActive: true },
      }),
    ]);

    // ── Pipeline metrics ────────────────────────────────────────────────────
    const byStage: OpportunityByStage[] = opportunitiesByStage.map((row) => ({
      stage: row.stage,
      count: row._count.id,
      totalValue: Number(row._sum.estimatedValue ?? 0),
    }));

    const pipeline: PipelineMetrics = {
      totalActiveOpportunities: opportunityAggregates._count.id,
      totalPipelineValue: Number(opportunityAggregates._sum.estimatedValue ?? 0),
      overdueNextActions,
      staleOpportunities,
      byStage,
    };

    // ── Proposal metrics ────────────────────────────────────────────────────
    let oldestPendingDays: number | null = null;
    if (oldestPending?.submittedForApprovalAt) {
      const ms = now.getTime() - oldestPending.submittedForApprovalAt.getTime();
      oldestPendingDays = Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    const proposals: ProposalMetrics = {
      totalProposals,
      pendingApproval: pendingVersions,
      approved: approvedVersions,
      rejected: rejectedVersions,
      oldestPendingDays,
    };

    // ── Project metrics ─────────────────────────────────────────────────────
    const ragBreakdown: RagBreakdown = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const row of ragCounts) {
      ragBreakdown[row.ragStatus as keyof RagBreakdown] = row._count.id;
    }

    const projects: ProjectMetrics = {
      totalActive: activeProjects,
      ragBreakdown,
      redProjects: redProjects as RedProject[],
      overdueGateDeliverables: overdueDeliverables,
    };

    // ── Quick counts ────────────────────────────────────────────────────────
    const quickCounts: QuickCounts = {
      activeAccounts,
      activeOpportunities: opportunityAggregates._count.id,
      activeProjects,
      proposalsPendingApproval: pendingVersions,
    };

    return {
      pipeline,
      proposals,
      projects,
      quickCounts,
      generatedAt: now.toISOString(),
    };
  }

  // ─── PMO Portfolio Metrics ─────────────────────────────────────────────────

  async getPmoMetrics(_user: UserContext) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      projectsByGate,
      projectsWithBlocker,
      pendingGateApprovals,
      overdueDeliverables,
      overdueMilestones,
      stalledProjects,
      criticalOpenIssues,
      pendingProposalVersions,
      totalActive,
      ragCounts,
    ] = await Promise.all([
      // Distribution of active projects across gates 1-6
      this.prisma.project.groupBy({
        by: ['currentGateNo'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
        orderBy: { currentGateNo: 'asc' },
      }),

      // Active projects that have a blocker set
      this.prisma.project.findMany({
        where: {
          status: 'ACTIVE',
          currentBlocker: { not: null },
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          ragStatus: true,
          currentGateNo: true,
          currentBlocker: true,
          blockerDueDate: true,
          blockerOwner: { select: { id: true, name: true } },
          projectManager: { select: { id: true, name: true } },
        },
        orderBy: [{ ragStatus: 'asc' }, { blockerDueDate: 'asc' }],
        take: 20,
      }),

      // Gates in SUBMITTED status — waiting for approval
      this.prisma.projectGate.findMany({
        where: {
          status: 'SUBMITTED',
          project: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          gateNo: true,
          gateName: true,
          updatedAt: true,
          pmoFlagged: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              projectManager: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'asc' },
      }),

      // Required deliverables still PENDING on active IN_PROGRESS gates
      this.prisma.gateDeliverable.findMany({
        where: {
          isRequired: true,
          status: 'PENDING',
          gate: {
            status: 'IN_PROGRESS',
            project: { status: 'ACTIVE' },
            targetDate: { lt: now }, // gate target date has passed
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          gate: {
            select: {
              gateNo: true,
              gateName: true,
              targetDate: true,
              project: {
                select: {
                  id: true,
                  projectCode: true,
                  name: true,
                  projectManager: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { gate: { targetDate: 'asc' } },
        take: 30,
      }),

      // Milestones past their targetDate and not yet complete
      this.prisma.milestone.findMany({
        where: {
          isComplete: false,
          targetDate: { lt: now },
          project: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          title: true,
          targetDate: true,
          baselineDate: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              projectManager: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { targetDate: 'asc' },
        take: 20,
      }),

      // Projects not updated in 14+ days (stalled)
      this.prisma.project.findMany({
        where: {
          status: 'ACTIVE',
          updatedAt: { lt: fourteenDaysAgo },
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          ragStatus: true,
          currentGateNo: true,
          updatedAt: true,
          projectManager: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'asc' },
        take: 15,
      }),

      // Open CRITICAL or HIGH issues across active projects
      this.prisma.issue.findMany({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          severity: { in: ['CRITICAL', 'HIGH'] },
          project: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          issueNo: true,
          title: true,
          severity: true,
          raisedDate: true,
          targetDate: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              projectManager: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ severity: 'desc' }, { raisedDate: 'asc' }],
        take: 20,
      }),

      // Proposal versions pending approval
      this.prisma.proposalVersion.count({
        where: { approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),

      // Total active projects
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),

      // RAG breakdown
      this.prisma.project.groupBy({
        by: ['ragStatus'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
    ]);

    // Build gate distribution array (fill gaps with 0)
    const gateDistribution = Array.from({ length: 6 }, (_, i) => {
      const gateNo = i + 1;
      const found = projectsByGate.find((r) => r.currentGateNo === gateNo);
      return { gateNo, count: found?._count.id ?? 0 };
    });

    const ragBreakdown = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const row of ragCounts) {
      ragBreakdown[row.ragStatus as keyof typeof ragBreakdown] = row._count.id;
    }

    return {
      quickCounts: {
        totalActiveProjects: totalActive,
        redProjects: ragBreakdown.RED,
        projectsWithBlocker: projectsWithBlocker.length,
        pendingGateApprovals: pendingGateApprovals.length,
        overdueDeliverables: overdueDeliverables.length,
        overdueMilestones: overdueMilestones.length,
        criticalOpenIssues: criticalOpenIssues.length,
        pendingProposalApprovals: pendingProposalVersions,
      },
      ragBreakdown,
      gateDistribution,
      projectsWithBlocker,
      pendingGateApprovals,
      overdueDeliverables,
      overdueMilestones,
      stalledProjects,
      criticalOpenIssues,
      generatedAt: now.toISOString(),
    };
  }
}
