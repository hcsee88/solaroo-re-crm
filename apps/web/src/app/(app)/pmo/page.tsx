"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { get } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type RagBreakdown = { GREEN: number; AMBER: number; RED: number };

type GateSlot = { gateNo: number; count: number };

type ProjectWithBlocker = {
  id: string;
  projectCode: string;
  name: string;
  ragStatus: string;
  currentGateNo: number;
  currentBlocker: string | null;
  blockerDueDate: string | null;
  blockerOwner: { id: string; name: string } | null;
  projectManager: { id: string; name: string };
};

type PendingGate = {
  id: string;
  gateNo: number;
  gateName: string;
  updatedAt: string;
  pmoFlagged: boolean;
  project: {
    id: string;
    projectCode: string;
    name: string;
    projectManager: { id: string; name: string };
  };
};

type OverdueDeliverable = {
  id: string;
  code: string;
  name: string;
  gate: {
    gateNo: number;
    gateName: string;
    targetDate: string | null;
    project: {
      id: string;
      projectCode: string;
      name: string;
      projectManager: { id: string; name: string };
    };
  };
};

type OverdueMilestone = {
  id: string;
  title: string;
  targetDate: string;
  baselineDate: string | null;
  project: {
    id: string;
    projectCode: string;
    name: string;
    projectManager: { id: string; name: string };
  };
};

type StalledProject = {
  id: string;
  projectCode: string;
  name: string;
  ragStatus: string;
  currentGateNo: number;
  updatedAt: string;
  projectManager: { id: string; name: string };
};

type CriticalIssue = {
  id: string;
  issueNo: string;
  title: string;
  severity: string;
  raisedDate: string;
  targetDate: string | null;
  project: {
    id: string;
    projectCode: string;
    name: string;
    projectManager: { id: string; name: string };
  };
};

type PmoMetrics = {
  quickCounts: {
    totalActiveProjects: number;
    redProjects: number;
    projectsWithBlocker: number;
    pendingGateApprovals: number;
    overdueDeliverables: number;
    overdueMilestones: number;
    criticalOpenIssues: number;
    pendingProposalApprovals: number;
  };
  ragBreakdown: RagBreakdown;
  gateDistribution: GateSlot[];
  projectsWithBlocker: ProjectWithBlocker[];
  pendingGateApprovals: PendingGate[];
  overdueDeliverables: OverdueDeliverable[];
  overdueMilestones: OverdueMilestone[];
  stalledProjects: StalledProject[];
  criticalOpenIssues: CriticalIssue[];
  generatedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GATE_NAMES: Record<number, string> = {
  1: "Contract & Handover",
  2: "Design Freeze",
  3: "Procurement Release",
  4: "Site Execution",
  5: "Commissioning",
  6: "Financial Close-out",
};

function RagBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
      status === "GREEN" && "bg-green-100 text-green-800",
      status === "AMBER" && "bg-yellow-100 text-yellow-800",
      status === "RED"   && "bg-red-100 text-red-800",
    )}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
      severity === "CRITICAL" && "bg-red-100 text-red-800",
      severity === "HIGH"     && "bg-orange-100 text-orange-800",
    )}>
      {severity}
    </span>
  );
}

function QuickStat({
  label, value, alert, href,
}: {
  label: string; value: string | number; alert?: boolean; href?: string;
}) {
  const inner = (
    <div className={cn(
      "rounded-lg border bg-card p-4",
      alert && value !== 0 && "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800",
    )}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn(
        "text-2xl font-bold mt-1 tabular-nums",
        alert && value !== 0 && "text-red-600 dark:text-red-400",
      )}>{value}</p>
    </div>
  );
  if (href && typeof value === "number" && value > 0) {
    return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  }
  return inner;
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-6 text-center text-xs text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground bg-muted/50 border-b">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 text-sm", className)}>{children}</td>;
}

function daysSince(date: string) {
  const d = new Date(date);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(date: string) {
  const d = new Date(date);
  const diff = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PmoPage() {
  const { data, isLoading, isError } = useQuery<PmoMetrics>({
    queryKey: ["pmo-metrics"],
    queryFn: () => get<PmoMetrics>("/reporting/pmo"),
    staleTime: 60 * 1000,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-7 w-40 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
      </div>
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );

  if (isError || !data) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-700">Failed to load PMO metrics</p>
      <p className="text-sm text-muted-foreground mt-1">Check API connectivity or your permissions.</p>
    </div>
  );

  const { quickCounts, ragBreakdown, gateDistribution, projectsWithBlocker,
          pendingGateApprovals, overdueDeliverables, overdueMilestones,
          stalledProjects, criticalOpenIssues, generatedAt } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">PMO Portfolio</h1>
          <p className="text-sm text-muted-foreground">Gate control · Milestone visibility · Exception reporting</p>
        </div>
        <p className="text-xs text-muted-foreground">Updated {new Date(generatedAt).toLocaleTimeString()}</p>
      </div>

      {/* Quick counts — 8 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickStat label="Active Projects"    value={quickCounts.totalActiveProjects} href="/projects" />
        <QuickStat label="Red Projects"       value={quickCounts.redProjects}          alert href="/projects" />
        <QuickStat label="Active Blockers"    value={quickCounts.projectsWithBlocker}  alert />
        <QuickStat label="Pending Gate Approv." value={quickCounts.pendingGateApprovals} alert />
        <QuickStat label="Overdue Deliverables" value={quickCounts.overdueDeliverables}  alert />
        <QuickStat label="Overdue Milestones"   value={quickCounts.overdueMilestones}    alert />
        <QuickStat label="Critical/High Issues" value={quickCounts.criticalOpenIssues}   alert />
        <QuickStat label="Pending Proposal Approv." value={quickCounts.pendingProposalApprovals} alert href="/proposals" />
      </div>

      {/* RAG Summary + Gate Distribution side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RAG Summary */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Portfolio RAG Status</h2>
          <div className="space-y-3">
            {(["RED", "AMBER", "GREEN"] as const).map((rag) => {
              const count = ragBreakdown[rag];
              const total = quickCounts.totalActiveProjects || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={rag}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <RagBadge status={rag} />
                    <span className="font-semibold tabular-nums">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        rag === "RED"   && "bg-red-500",
                        rag === "AMBER" && "bg-yellow-400",
                        rag === "GREEN" && "bg-green-500",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gate Distribution */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Active Projects by Gate</h2>
          <div className="space-y-2">
            {gateDistribution.map(({ gateNo, count }) => {
              const max = Math.max(...gateDistribution.map((g) => g.count), 1);
              return (
                <div key={gateNo} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-xs font-mono text-muted-foreground flex-shrink-0">G{gateNo}</span>
                  <span className="w-36 text-xs text-muted-foreground truncate flex-shrink-0">{GATE_NAMES[gateNo]}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: count > 0 ? `${Math.max((count / max) * 100, 8)}%` : "0%" }}
                    />
                  </div>
                  <span className="w-6 text-xs font-semibold tabular-nums text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending Gate Approvals */}
      <div>
        <SectionHeader title="Gates Pending Approval" count={pendingGateApprovals.length} />
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Gate</Th>
              <Th>PM</Th>
              <Th>Submitted</Th>
              <Th>PMO Flagged</Th>
            </tr>
          </thead>
          <tbody>
            {pendingGateApprovals.length === 0 ? (
              <EmptyRow message="No gates pending approval." />
            ) : pendingGateApprovals.map((g) => (
              <tr key={g.id} className="border-t hover:bg-muted/30">
                <Td>
                  <Link href={`/projects/${g.project.id}`} className="font-medium hover:text-primary hover:underline">
                    {g.project.projectCode}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{g.project.name}</p>
                </Td>
                <Td>
                  <span className="font-mono text-xs">G{g.gateNo}</span>
                  <p className="text-xs text-muted-foreground">{g.gateName}</p>
                </Td>
                <Td className="text-xs text-muted-foreground">{g.project.projectManager.name}</Td>
                <Td>
                  <span className={cn("text-xs", daysSince(g.updatedAt) > 7 && "text-red-600 font-medium")}>
                    {daysSince(g.updatedAt)}d ago
                  </span>
                </Td>
                <Td>
                  {g.pmoFlagged && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                      ⚑ Flagged
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* Active Blockers */}
      <div>
        <SectionHeader title="Active Project Blockers" count={projectsWithBlocker.length} />
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>RAG</Th>
              <Th>Gate</Th>
              <Th>Blocker</Th>
              <Th>Owner</Th>
              <Th>Due</Th>
            </tr>
          </thead>
          <tbody>
            {projectsWithBlocker.length === 0 ? (
              <EmptyRow message="No active blockers. All projects clear." />
            ) : projectsWithBlocker.map((p) => {
              const due = p.blockerDueDate ? daysUntil(p.blockerDueDate) : null;
              const overdue = due !== null && due < 0;
              return (
                <tr key={p.id} className={cn("border-t", overdue ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-muted/30")}>
                  <Td>
                    <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                      {p.projectCode}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.name}</p>
                  </Td>
                  <Td><RagBadge status={p.ragStatus} /></Td>
                  <Td className="font-mono text-xs">G{p.currentGateNo}</Td>
                  <Td>
                    <p className="text-xs max-w-[200px] truncate" title={p.currentBlocker ?? ""}>{p.currentBlocker}</p>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{p.blockerOwner?.name ?? p.projectManager.name}</Td>
                  <Td>
                    {p.blockerDueDate ? (
                      <span className={cn("text-xs", overdue ? "text-red-600 font-medium" : due !== null && due <= 3 ? "text-orange-600" : "text-muted-foreground")}>
                        {overdue ? `${Math.abs(due!)}d overdue` : due === 0 ? "Today" : `${due}d`}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>

      {/* Overdue Gate Deliverables */}
      <div>
        <SectionHeader title="Overdue Gate Deliverables" count={overdueDeliverables.length} />
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Gate</Th>
              <Th>Deliverable</Th>
              <Th>Gate Target</Th>
              <Th>PM</Th>
            </tr>
          </thead>
          <tbody>
            {overdueDeliverables.length === 0 ? (
              <EmptyRow message="No overdue gate deliverables." />
            ) : overdueDeliverables.map((d) => (
              <tr key={d.id} className="border-t hover:bg-muted/30">
                <Td>
                  <Link href={`/projects/${d.gate.project.id}`} className="font-medium hover:text-primary hover:underline">
                    {d.gate.project.projectCode}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[160px]">{d.gate.project.name}</p>
                </Td>
                <Td>
                  <span className="font-mono text-xs">G{d.gate.gateNo}</span>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                  <p className="text-xs truncate max-w-[200px]">{d.name}</p>
                </Td>
                <Td className="text-xs text-red-600 font-medium">
                  {d.gate.targetDate ? new Date(d.gate.targetDate).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}
                </Td>
                <Td className="text-xs text-muted-foreground">{d.gate.project.projectManager.name}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* Overdue Milestones */}
      <div>
        <SectionHeader title="Overdue Milestones" count={overdueMilestones.length} />
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Milestone</Th>
              <Th>Baseline</Th>
              <Th>Target</Th>
              <Th>Days Late</Th>
              <Th>PM</Th>
            </tr>
          </thead>
          <tbody>
            {overdueMilestones.length === 0 ? (
              <EmptyRow message="No overdue milestones." />
            ) : overdueMilestones.map((m) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <Td>
                  <Link href={`/projects/${m.project.id}`} className="font-medium hover:text-primary hover:underline">
                    {m.project.projectCode}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{m.project.name}</p>
                </Td>
                <Td className="text-xs font-medium max-w-[180px] truncate">{m.title}</Td>
                <Td className="text-xs text-muted-foreground">
                  {m.baselineDate ? new Date(m.baselineDate).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                </Td>
                <Td className="text-xs text-red-600 font-medium">
                  {new Date(m.targetDate).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "2-digit" })}
                </Td>
                <Td className="text-xs text-red-600 font-medium tabular-nums">{daysSince(m.targetDate)}d</Td>
                <Td className="text-xs text-muted-foreground">{m.project.projectManager.name}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* Critical / High Issues */}
      <div>
        <SectionHeader title="Critical & High Issues" count={criticalOpenIssues.length} />
        <TableWrap>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Issue</Th>
              <Th>Severity</Th>
              <Th>Raised</Th>
              <Th>Target</Th>
              <Th>PM</Th>
            </tr>
          </thead>
          <tbody>
            {criticalOpenIssues.length === 0 ? (
              <EmptyRow message="No critical or high issues open." />
            ) : criticalOpenIssues.map((i) => (
              <tr key={i.id} className="border-t hover:bg-muted/30">
                <Td>
                  <Link href={`/projects/${i.project.id}`} className="font-medium hover:text-primary hover:underline">
                    {i.project.projectCode}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{i.project.name}</p>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-muted-foreground">{i.issueNo}</span>
                  <p className="text-xs truncate max-w-[200px]">{i.title}</p>
                </Td>
                <Td><SeverityBadge severity={i.severity} /></Td>
                <Td className="text-xs text-muted-foreground">{daysSince(i.raisedDate)}d ago</Td>
                <Td className="text-xs text-muted-foreground">
                  {i.targetDate ? new Date(i.targetDate).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}
                </Td>
                <Td className="text-xs text-muted-foreground">{i.project.projectManager.name}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* Stalled Projects */}
      {stalledProjects.length > 0 && (
        <div>
          <SectionHeader title={`Stalled Projects (no update in 14+ days)`} count={stalledProjects.length} />
          <TableWrap>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>RAG</Th>
                <Th>Gate</Th>
                <Th>Last Updated</Th>
                <Th>PM</Th>
              </tr>
            </thead>
            <tbody>
              {stalledProjects.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <Td>
                    <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                      {p.projectCode}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.name}</p>
                  </Td>
                  <Td><RagBadge status={p.ragStatus} /></Td>
                  <Td className="font-mono text-xs">G{p.currentGateNo}</Td>
                  <Td className="text-xs text-orange-600 font-medium">{daysSince(p.updatedAt)}d ago</Td>
                  <Td className="text-xs text-muted-foreground">{p.projectManager.name}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        Data as of {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
