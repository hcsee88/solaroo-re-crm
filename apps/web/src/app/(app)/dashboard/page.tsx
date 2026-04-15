"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { get } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useRoleName } from "@/hooks/use-current-user";
import {
  canSeePipelineSection,
  canSeePipelineValue,
  canSeeProposalSection,
  canSeeAccountsCount,
} from "@/lib/role-ui";

// ─── Types (mirror reporting.service.ts) ──────────────────────────────────────

type OpportunityByStage = { stage: string; count: number; totalValue: number };

type PipelineMetrics = {
  totalActiveOpportunities: number;
  totalPipelineValue: number;
  overdueNextActions: number;
  staleOpportunities: number;
  byStage: OpportunityByStage[];
};

type ProposalMetrics = {
  totalProposals: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  oldestPendingDays: number | null;
};

type RagBreakdown = { GREEN: number; AMBER: number; RED: number };

type RedProject = {
  id: string;
  projectCode: string;
  name: string;
  currentBlocker: string | null;
  blockerDueDate: string | null;
  blockerOwner: { id: string; name: string } | null;
  projectManager: { id: string; name: string };
};

type ProjectMetrics = {
  totalActive: number;
  ragBreakdown: RagBreakdown;
  redProjects: RedProject[];
  overdueGateDeliverables: number;
};

type QuickCounts = {
  activeAccounts: number;
  activeOpportunities: number;
  activeProjects: number;
  proposalsPendingApproval: number;
};

type DashboardMetrics = {
  pipeline: PipelineMetrics;
  proposals: ProposalMetrics;
  projects: ProjectMetrics;
  quickCounts: QuickCounts;
  generatedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMYR(value: number): string {
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `RM ${(value / 1_000).toFixed(0)}K`;
  return `RM ${value.toLocaleString()}`;
}

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUALIFIED: "Qualified",
  DATA_COLLECTION: "Data Collection",
  SITE_ASSESSMENT_PENDING: "Site Assessment",
  CONCEPT_DESIGN: "Concept Design",
  BUDGETARY_PROPOSAL: "Budgetary Proposal",
  FIRM_PROPOSAL: "Firm Proposal",
  NEGOTIATION: "Negotiation",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  alert,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        alert && "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-bold mt-1 tabular-nums", alert && "text-red-600 dark:text-red-400")}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  return content;
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RagBadge({ status }: { status: "GREEN" | "AMBER" | "RED" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
        status === "GREEN" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        status === "AMBER" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        status === "RED" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      )}
    >
      {status}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const roleName         = useRoleName();
  const showPipeline     = canSeePipelineSection(roleName);
  const showPipelineVal  = canSeePipelineValue(roleName);
  const showProposals    = canSeeProposalSection(roleName);
  const showAccountsCard = canSeeAccountsCount(roleName);

  const { data, isLoading, isError } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: () => get<DashboardMetrics>("/reporting/dashboard"),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <DashboardError />;

  const { pipeline, proposals, projects, quickCounts, generatedAt } = data;

  // How many quick-count cards to show affects the grid columns
  const quickCountCards = [
    showAccountsCard && {
      label: "Active Accounts",
      value: quickCounts.activeAccounts,
      href: "/accounts",
    },
    showPipeline && {
      label: "Active Opportunities",
      value: quickCounts.activeOpportunities,
      href: "/opportunities",
    },
    {
      label: "Active Projects",
      value: quickCounts.activeProjects,
      href: "/projects",
    },
    showProposals && {
      label: "Proposals Pending",
      value: quickCounts.proposalsPendingApproval,
      alert: quickCounts.proposalsPendingApproval > 0,
      href: "/proposals",
    },
  ].filter(Boolean) as { label: string; value: number; alert?: boolean; href: string }[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Operations overview</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Quick counts row — role-shaped */}
      <div className={cn(
        "grid gap-4",
        quickCountCards.length === 4 && "grid-cols-2 md:grid-cols-4",
        quickCountCards.length === 3 && "grid-cols-2 md:grid-cols-3",
        quickCountCards.length === 2 && "grid-cols-2",
        quickCountCards.length === 1 && "grid-cols-1 max-w-xs",
      )}>
        {quickCountCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            alert={card.alert}
            href={card.href}
          />
        ))}
      </div>

      {/* Pipeline + Proposals row — only for relevant roles */}
      {(showPipeline || showProposals) && (
        <div className={cn(
          "grid gap-6",
          showPipeline && showProposals ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl"
        )}>
          {/* Pipeline Health */}
          {showPipeline && (
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <SectionHeader
                title="Pipeline Health"
                sub={`${pipeline.totalActiveOpportunities} active opportunities`}
              />

              <div className="grid grid-cols-2 gap-3">
                {showPipelineVal && (
                  <div>
                    <p className="text-xs text-muted-foreground">Total Pipeline Value</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatMYR(pipeline.totalPipelineValue)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Overdue Next Actions</p>
                  {pipeline.overdueNextActions > 0 ? (
                    <Link
                      href="/opportunities?overdue=true"
                      className={cn("text-xl font-bold tabular-nums underline decoration-dotted hover:decoration-solid", "text-red-600 dark:text-red-400")}
                      title="Click to see overdue opportunities"
                    >
                      {pipeline.overdueNextActions}
                    </Link>
                  ) : (
                    <p className="text-xl font-bold tabular-nums">{pipeline.overdueNextActions}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stale (30+ days)</p>
                  <p className={cn("text-xl font-bold tabular-nums", pipeline.staleOpportunities > 0 && "text-yellow-600 dark:text-yellow-400")}>
                    {pipeline.staleOpportunities}
                  </p>
                </div>
              </div>

              {/* By stage breakdown */}
              {pipeline.byStage.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">By Stage</p>
                  <div className="space-y-1">
                    {pipeline.byStage.map((row) => (
                      <div key={row.stage} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {STAGE_LABELS[row.stage] ?? row.stage}
                        </span>
                        <div className="flex gap-4 tabular-nums">
                          <span className="font-medium">{row.count}</span>
                          {showPipelineVal && (
                            <span className="text-muted-foreground w-24 text-right">
                              {row.totalValue > 0 ? formatMYR(row.totalValue) : "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proposal Status */}
          {showProposals && (
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <SectionHeader
                title="Proposal Status"
                sub={`${proposals.totalProposals} total proposals`}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Pending Approval</p>
                  <p className={cn("text-xl font-bold tabular-nums", proposals.pendingApproval > 0 && "text-orange-600 dark:text-orange-400")}>
                    {proposals.pendingApproval}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    {proposals.approved}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                  <p className="text-xl font-bold tabular-nums">{proposals.rejected}</p>
                </div>
                {proposals.oldestPendingDays !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Oldest Pending</p>
                    <p className={cn(
                      "text-xl font-bold tabular-nums",
                      proposals.oldestPendingDays > 7 && "text-red-600 dark:text-red-400"
                    )}>
                      {proposals.oldestPendingDays}d
                    </p>
                  </div>
                )}
              </div>
              <Link
                href="/proposals"
                className="text-xs text-primary hover:underline block mt-2"
              >
                View all proposals →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Project Health — visible to all roles */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Project Health"
            sub={`${projects.totalActive} active projects`}
          />
          {projects.overdueGateDeliverables > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {projects.overdueGateDeliverables} overdue deliverable{projects.overdueGateDeliverables !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* RAG summary */}
        <div className="flex gap-4">
          {(["GREEN", "AMBER", "RED"] as const).map((rag) => (
            <div key={rag} className="flex items-center gap-2">
              <RagBadge status={rag} />
              <span className="text-lg font-bold tabular-nums">{projects.ragBreakdown[rag]}</span>
            </div>
          ))}
        </div>

        {/* RED projects detail */}
        {projects.redProjects.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">
              Red Projects — Blockers
            </p>
            <div className="space-y-2">
              {projects.redProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 rounded-md border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${proj.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {proj.projectCode} — {proj.name}
                    </Link>
                    {proj.currentBlocker && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {proj.currentBlocker}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    {proj.blockerOwner && <p>{proj.blockerOwner.name}</p>}
                    {proj.blockerDueDate && (
                      <p className={cn(
                        new Date(proj.blockerDueDate) < new Date() && "text-red-600 dark:text-red-400 font-medium"
                      )}>
                        Due {new Date(proj.blockerDueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {projects.redProjects.length === 0 && projects.ragBreakdown.RED === 0 && (
          <p className="text-sm text-green-600 dark:text-green-400">No red projects. All projects healthy.</p>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-right">
        Data as of {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <SkeletonBlock className="h-7 w-40 mb-1" />
        <SkeletonBlock className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
      <SkeletonBlock className="h-48" />
    </div>
  );
}

function DashboardError() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-6 text-center">
      <p className="font-medium text-red-700 dark:text-red-300">Failed to load dashboard metrics</p>
      <p className="text-sm text-muted-foreground mt-1">Check API connectivity or your permissions.</p>
    </div>
  );
}
