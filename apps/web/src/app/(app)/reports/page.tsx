"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  FolderKanban,
  FileSignature,
  Activity,
  Download,
  ExternalLink,
} from "lucide-react";
import { get } from "@/lib/api-client";
import { AuditTrail } from "@/components/audit/audit-trail";

// ─── Types (mirror backend ReportingService) ──────────────────────────────────

type DashboardMetrics = {
  pipeline: {
    totalActiveOpportunities: number;
    totalPipelineValue: number;
    overdueNextActions: number;
    staleOpportunities: number;
    byStage: { stage: string; count: number; totalValue: number }[];
  };
  proposals: {
    totalProposals: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    oldestPendingDays: number | null;
  };
  projects: {
    totalActive: number;
    ragBreakdown: { GREEN: number; AMBER: number; RED: number };
    overdueGateDeliverables: number;
  };
  quickCounts: {
    activeAccounts: number;
    activeOpportunities: number;
    activeProjects: number;
    proposalsPendingApproval: number;
  };
  generatedAt: string;
};

type PmoMetrics = {
  gateDistribution: { gateNo: number; count: number }[];
  contractVariance: {
    activeCount: number;
    handoverBuckets: { NOT_STARTED: number; READY: number; IN_PROGRESS: number; COMPLETED: number };
    byCurrency: {
      currency: string;
      contracted: number;
      invoiced: number;
      paid: number;
      outstanding: number;
      count: number;
      invoicedPercent: number;
      paidPercent: number;
    }[];
  };
};

const STAGE_ORDER = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

const GATE_NAMES: Record<number, string> = {
  1: "Contract & Handover",
  2: "Design Freeze",
  3: "Procurement Release",
  4: "Site Execution",
  5: "Commissioning",
  6: "Financial Close-out",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, prefix = "RM"): string {
  if (n >= 1_000_000) return `${prefix} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix} ${(n / 1_000).toFixed(0)}K`;
  return `${prefix} ${n.toFixed(0)}`;
}

function fmtFull(n: number, ccy = "RM"): string {
  return `${ccy} ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      // Escape quotes; wrap if comma/quote/newline present
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dash, setDash]       = useState<DashboardMetrics | null>(null);
  const [pmo, setPmo]         = useState<PmoMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      get<DashboardMetrics>("/reporting/dashboard"),
      get<PmoMetrics>("/reporting/pmo"),
    ])
      .then(([d, p]) => { setDash(d); setPmo(p); })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 403
          ? "You don't have permission to view reports. Reports require the reporting:view permission."
          : ((err as Error).message ?? "Failed to load reports"));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading reports…</div>;
  }
  if (error || !dash) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-6 h-6" style={{ color: "#676879" }} />
          <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Reports</h1>
        </div>
        <div className="rounded-md p-3 text-sm" style={{ background: "#fde8ec", color: "#a52840" }}>
          {error ?? "Could not load report data"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6" style={{ color: "#676879" }} />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Reports</h1>
            <p className="text-sm mt-1" style={{ color: "#676879" }}>
              High-level snapshot across pipeline, projects, contracts and recent activity.
              Drill into each section via the linked dashboards.
            </p>
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: "#a3a8b5" }}>
          As of {new Date(dash.generatedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>

      {/* Quick KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active accounts"    value={dash.quickCounts.activeAccounts} />
        <Kpi label="Active opps"        value={dash.quickCounts.activeOpportunities} colour="#0073ea" />
        <Kpi label="Active projects"    value={dash.quickCounts.activeProjects}      colour="#a25ddc" />
        <Kpi label="Pending proposals"  value={dash.quickCounts.proposalsPendingApproval} colour="#fdab3d" />
      </div>

      {/* ── Pipeline Report ───────────────────────────────────────────────── */}
      <Section title="Pipeline" icon={<TrendingUp className="w-4 h-4" />} link={{ href: "/opportunities", label: "Open opportunities →" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Pipeline value" value={fmt(dash.pipeline.totalPipelineValue)} caption={`across ${dash.pipeline.totalActiveOpportunities} active opps`} />
          <Card title="Overdue next-actions" value={dash.pipeline.overdueNextActions} caption={dash.pipeline.overdueNextActions > 0 ? "needs follow-up" : "all current"} colour={dash.pipeline.overdueNextActions > 0 ? "#a52840" : "#00854f"} />
          <Card title="Stale opportunities" value={dash.pipeline.staleOpportunities} caption="no update in 30+ days" colour={dash.pipeline.staleOpportunities > 0 ? "#fdab3d" : "#00854f"} />
        </div>

        <div className="mt-4 rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>By stage</h3>
            <button
              onClick={() => downloadCsv("pipeline_by_stage.csv", [
                ["stage", "count", "total_value_rm"],
                ...STAGE_ORDER.map((s) => {
                  const r = dash.pipeline.byStage.find((x) => x.stage === s);
                  return [s, r?.count ?? 0, r?.totalValue ?? 0];
                }),
              ])}
              className="text-xs inline-flex items-center gap-1"
              style={{ color: "#0073ea" }}
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead style={{ color: "#a3a8b5" }}>
              <tr className="text-left text-xs">
                <th className="py-1.5 font-medium">Stage</th>
                <th className="py-1.5 font-medium text-right">Count</th>
                <th className="py-1.5 font-medium text-right">Total value</th>
                <th className="py-1.5 font-medium" style={{ width: "40%" }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((stage) => {
                const row = dash.pipeline.byStage.find((x) => x.stage === stage);
                const count = row?.count ?? 0;
                const value = row?.totalValue ?? 0;
                const maxCount = Math.max(1, ...dash.pipeline.byStage.map((x) => x.count));
                const pct = (count / maxCount) * 100;
                return (
                  <tr key={stage} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                    <td className="py-2" style={{ color: "#323338" }}>{stage}</td>
                    <td className="py-2 text-right" style={{ color: "#323338" }}>{count}</td>
                    <td className="py-2 text-right" style={{ color: "#676879" }}>{value > 0 ? fmt(value) : "—"}</td>
                    <td className="py-2 pl-3">
                      <div className="h-2 rounded-full" style={{ background: "hsl(218 23% 93%)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: stage === "WON" ? "#00ca72" : stage === "LOST" ? "#a52840" : "#0073ea" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Project Portfolio ─────────────────────────────────────────────── */}
      <Section title="Project portfolio" icon={<FolderKanban className="w-4 h-4" />} link={{ href: "/pmo", label: "Open PMO dashboard →" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RagCard rag={dash.projects.ragBreakdown} total={dash.projects.totalActive} />
          <Card title="Overdue deliverables" value={dash.projects.overdueGateDeliverables} caption="across active gates" colour={dash.projects.overdueGateDeliverables > 0 ? "#a52840" : "#00854f"} />
          {pmo?.contractVariance && (
            <Card title="Contracts in execution" value={pmo.contractVariance.handoverBuckets.COMPLETED} caption={`of ${pmo.contractVariance.activeCount} total active`} />
          )}
        </div>

        {pmo?.gateDistribution && (
          <div className="mt-4 rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#676879" }}>Active projects per gate</h3>
            <div className="grid grid-cols-6 gap-2">
              {pmo.gateDistribution.map(({ gateNo, count }) => {
                const max = Math.max(1, ...pmo.gateDistribution.map((g) => g.count));
                return (
                  <div key={gateNo} className="text-center">
                    <div className="text-2xl font-semibold" style={{ color: "#323338" }}>{count}</div>
                    <div className="text-xs mb-1" style={{ color: "#676879" }}>G{gateNo}</div>
                    <div className="text-xs leading-tight" style={{ color: "#a3a8b5" }}>{GATE_NAMES[gateNo]}</div>
                    <div className="mt-2 h-16 flex items-end justify-center">
                      <div className="w-6 rounded-t" style={{ height: `${(count / max) * 100}%`, background: "#0073ea", minHeight: count > 0 ? "4px" : "0" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ── Commercial / Cash position ────────────────────────────────────── */}
      {pmo?.contractVariance && pmo.contractVariance.activeCount > 0 && (
        <Section title="Commercial position" icon={<FileSignature className="w-4 h-4" />} link={{ href: "/contracts", label: "Open contracts →" }}>
          <div className="grid grid-cols-4 gap-3 rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            {(["NOT_STARTED", "READY", "IN_PROGRESS", "COMPLETED"] as const).map((k) => (
              <div key={k} className="text-center">
                <div className="text-2xl font-semibold" style={{ color: "#323338" }}>
                  {pmo.contractVariance.handoverBuckets[k]}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#676879" }}>
                  Handover · {k.replace("_", " ").toLowerCase()}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-white p-4 space-y-3" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>Cash position by currency</h3>
              <button
                onClick={() => downloadCsv("contract_cash_position.csv", [
                  ["currency", "contract_count", "contracted", "invoiced", "paid", "outstanding", "invoiced_pct", "paid_pct"],
                  ...pmo.contractVariance.byCurrency.map((r) => [
                    r.currency, r.count, r.contracted, r.invoiced, r.paid, r.outstanding, r.invoicedPercent, r.paidPercent,
                  ]),
                ])}
                className="text-xs inline-flex items-center gap-1"
                style={{ color: "#0073ea" }}
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
            {pmo.contractVariance.byCurrency.map((row) => (
              <div key={row.currency}>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <Stat label={`Contracted (${row.currency})`} value={fmtFull(row.contracted, row.currency)} />
                  <Stat label="Invoiced"   value={fmtFull(row.invoiced, row.currency)}    sub={`${row.invoicedPercent}%`} colour="#0073ea" />
                  <Stat label="Paid"       value={fmtFull(row.paid, row.currency)}        sub={`${row.paidPercent}%`}     colour="#00854f" />
                  <Stat label="Outstanding" value={fmtFull(row.outstanding, row.currency)}                                  colour={row.outstanding > 0 ? "#a52840" : "#676879"} />
                </div>
                <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{ background: "hsl(218 23% 93%)" }}>
                  <div style={{ width: `${Math.min(100, row.paidPercent)}%`, background: "#00ca72" }} />
                  <div style={{ width: `${Math.min(100 - row.paidPercent, Math.max(0, row.invoicedPercent - row.paidPercent))}%`, background: "#fdab3d" }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Proposal pipeline summary ─────────────────────────────────────── */}
      <Section title="Proposal pipeline" icon={<TrendingUp className="w-4 h-4" />} link={{ href: "/proposals", label: "Open proposals →" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card title="Total proposals"    value={dash.proposals.totalProposals} />
          <Card title="Pending approval"   value={dash.proposals.pendingApproval} colour={dash.proposals.pendingApproval > 0 ? "#fdab3d" : "#00854f"} />
          <Card title="Approved"           value={dash.proposals.approved}  colour="#00854f" />
          <Card title="Oldest pending"     value={dash.proposals.oldestPendingDays != null ? `${dash.proposals.oldestPendingDays}d` : "—"} caption={dash.proposals.oldestPendingDays != null && dash.proposals.oldestPendingDays > 7 ? "follow up" : ""} colour={dash.proposals.oldestPendingDays != null && dash.proposals.oldestPendingDays > 7 ? "#a52840" : "#676879"} />
        </div>
      </Section>

      {/* ── Recent activity (audit trail snippet) ─────────────────────────── */}
      <Section title="Recent activity" icon={<Activity className="w-4 h-4" />} link={{ href: "/admin/audit", label: "Open full audit log →" }}>
        <AuditTrail pageSize={15} showResource />
      </Section>
    </div>
  );
}

// ─── Reusable building blocks ────────────────────────────────────────────────

function Section({
  title,
  icon,
  link,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "#323338" }}>
          <span style={{ color: "#676879" }}>{icon}</span>
          {title}
        </h2>
        {link && (
          <Link href={link.href} className="text-xs inline-flex items-center gap-1" style={{ color: "#0073ea" }}>
            {link.label} <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, colour = "#323338" }: { label: string; value: number | string; colour?: string }) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="text-xs" style={{ color: "#676879" }}>{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color: colour }}>{value}</div>
    </div>
  );
}

function Card({
  title, value, caption, colour = "#323338",
}: {
  title: string;
  value: number | string;
  caption?: string;
  colour?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="text-xs" style={{ color: "#676879" }}>{title}</div>
      <div className="text-xl font-semibold mt-1" style={{ color: colour }}>{value}</div>
      {caption && <div className="text-xs mt-1" style={{ color: "#a3a8b5" }}>{caption}</div>}
    </div>
  );
}

function RagCard({ rag, total }: { rag: { GREEN: number; AMBER: number; RED: number }; total: number }) {
  const segments = [
    { key: "GREEN", count: rag.GREEN, colour: "#00ca72" },
    { key: "AMBER", count: rag.AMBER, colour: "#fdab3d" },
    { key: "RED",   count: rag.RED,   colour: "#a52840" },
  ];
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex items-baseline justify-between">
        <div className="text-xs" style={{ color: "#676879" }}>Project RAG</div>
        <div className="text-xs" style={{ color: "#a3a8b5" }}>{total} active</div>
      </div>
      <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{ background: "hsl(218 23% 93%)" }}>
        {segments.map((s) => (
          total > 0 ? <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.colour }} /> : null
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        {segments.map((s) => (
          <span key={s.key} style={{ color: s.colour }}>
            ● {s.key} <span style={{ color: "#676879" }}>{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, colour = "#323338" }: { label: string; value: string; sub?: string; colour?: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "#676879" }}>{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: colour }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "#a3a8b5" }}>{sub}</div>}
    </div>
  );
}
