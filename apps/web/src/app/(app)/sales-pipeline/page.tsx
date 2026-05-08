"use client";

// Sales Pipeline Lite (2026-05-08).
//   - 5 quick cards (operational signals only — no forecast pressure)
//   - 1 simple Pipeline-by-Stage breakdown
//   - 1 "Needs attention" table (overdue + no-next-action)
//
// Removed vs the original V1 dashboard (intentionally — see
// docs/sales-pipeline-lite.md and docs/sales-dashboard-v1.md):
//   - Closing this month / quarter forecast
//   - Activity volume per salesperson (ranking-like)
//   - Top 10 by value
// The "By stage" breakdown shows COUNT (and value where the role can see it).

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendingUp, AlertCircle, FileText, ExternalLink } from "lucide-react";
import { get } from "@/lib/api-client";
import { useRoleName } from "@/hooks/use-current-user";
import { canSeePipelineValue } from "@/lib/role-ui";

type SalesPipelineMetrics = {
  pipelineSummary: {
    totalActiveOpportunities: number;
    totalPipelineValue: number;
    weightedPipelineValue: number;
    averageDealSize: number;
  };
  stageBreakdown: { stage: string; count: number; value: number }[];
  followUpMonitoring: {
    overdueNextActions: number;
    noNextAction: number;
    staleOpportunities30d: number;
  };
  proposalMonitoring: {
    proposalsAwaitingFollowup: number;
    items: {
      id: string; opportunityCode: string; title: string; stage: string;
      owner:   { id: string; name: string };
      account: { id: string; name: string };
    }[];
  };
  needsAttention: {
    id: string; opportunityCode: string; title: string; stage: string;
    nextAction: string | null;
    nextActionDueDate: string | null;
    updatedAt: string;
    owner:   { id: string; name: string };
    account: { id: string; name: string };
  }[];
  topOpportunities: unknown;     // present in API, not rendered in Lite
  wonThisMonth: { count: number; value: number };
  generatedAt: string;
};

const STAGE_ORDER = [
  "LEAD", "QUALIFIED", "DATA_COLLECTION", "SITE_ASSESSMENT_PENDING",
  "CONCEPT_DESIGN", "BUDGETARY_PROPOSAL", "FIRM_PROPOSAL", "NEGOTIATION", "CONTRACTING",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `RM ${(n / 1_000).toFixed(0)}K`;
  return `RM ${n.toFixed(0)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function daysFromNow(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (diff === 0)  return "today";
  if (diff < 0)   return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}

export default function SalesPipelinePage() {
  const [data, setData] = useState<SalesPipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleName = useRoleName();
  const canSeeValues = canSeePipelineValue(roleName);

  useEffect(() => {
    get<SalesPipelineMetrics>("/reporting/sales-pipeline")
      .then(setData)
      .catch((err) => {
        const status = (err as { status?: number })?.status;
        setError(status === 403
          ? "You don't have permission to view sales pipeline reports."
          : ((err as Error).message ?? "Failed to load"));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading sales pipeline…</div>;
  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "#323338" }}>Sales Pipeline</h1>
        <div className="rounded-md p-3 text-sm" style={{ background: "#fde8ec", color: "#a52840" }}>
          {error ?? "Could not load report data"}
        </div>
      </div>
    );
  }

  const maxStageCount = Math.max(1, ...data.stageBreakdown.map((s) => s.count));

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6" style={{ color: "#0073ea" }} />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Sales Pipeline</h1>
            <p className="text-sm mt-1" style={{ color: "#676879" }}>
              Where the team is on follow-up discipline. No closing pressure — just signal.
            </p>
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: "#a3a8b5" }}>
          As of {new Date(data.generatedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>

      {/* ── 5 Quick cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi
          label="Active opportunities"
          value={data.pipelineSummary.totalActiveOpportunities}
          caption={canSeeValues ? fmt(data.pipelineSummary.totalPipelineValue) : undefined}
          link="/opportunities?myOnly=false"
        />
        <Kpi
          label="No next action"
          value={data.followUpMonitoring.noNextAction}
          tone={data.followUpMonitoring.noNextAction > 0 ? "warn" : "ok"}
          link="/opportunities?noNextAction=true"
        />
        <Kpi
          label="Overdue follow-ups"
          value={data.followUpMonitoring.overdueNextActions}
          tone={data.followUpMonitoring.overdueNextActions > 0 ? "alert" : "ok"}
          link="/opportunities?overdueNextAction=true"
        />
        <Kpi
          label="Stale (30+ days)"
          value={data.followUpMonitoring.staleOpportunities30d}
          tone={data.followUpMonitoring.staleOpportunities30d > 0 ? "warn" : "ok"}
          link="/opportunities?noActivity30d=true"
        />
        <Kpi
          label="Proposals awaiting follow-up"
          value={data.proposalMonitoring.proposalsAwaitingFollowup}
          tone={data.proposalMonitoring.proposalsAwaitingFollowup > 0 ? "warn" : "ok"}
          link="/opportunities?proposalSubmitted=true"
        />
      </div>

      {/* ── Pipeline by Stage ─────────────────────────────────────────── */}
      <Section title="Pipeline by stage" icon={<TrendingUp className="w-4 h-4" />} link={{ href: "/opportunities", label: "Open opportunities →" }}>
        <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          <table className="w-full text-sm">
            <thead style={{ color: "#a3a8b5" }}>
              <tr className="text-left text-xs">
                <th className="py-1.5 font-medium">Stage</th>
                <th className="py-1.5 font-medium text-right">Count</th>
                {canSeeValues && <th className="py-1.5 font-medium text-right">Value</th>}
                <th className="py-1.5 font-medium" style={{ width: "40%" }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((stage) => {
                const row = data.stageBreakdown.find((x) => x.stage === stage);
                const count = row?.count ?? 0;
                const pct = (count / maxStageCount) * 100;
                return (
                  <tr key={stage} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                    <td className="py-2" style={{ color: "#323338" }}>{stage.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right" style={{ color: "#323338" }}>{count}</td>
                    {canSeeValues && (
                      <td className="py-2 text-right" style={{ color: "#676879" }}>
                        {count > 0 ? fmt(row?.value ?? 0) : "—"}
                      </td>
                    )}
                    <td className="py-2 pl-3">
                      <div className="h-2 rounded-full" style={{ background: "hsl(218 23% 93%)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#0073ea" }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Needs attention table ─────────────────────────────────────── */}
      <Section title="Needs attention" icon={<AlertCircle className="w-4 h-4" />} link={{ href: "/opportunities?noNextAction=true", label: "View all →" }}>
        <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          {data.needsAttention.length === 0 ? (
            <div className="text-sm py-2" style={{ color: "#676879" }}>
              You&apos;re all caught up — no opportunities need attention right now.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ color: "#a3a8b5" }}>
                <tr className="text-left text-xs">
                  <th className="py-1.5 font-medium">Code</th>
                  <th className="py-1.5 font-medium">Title</th>
                  <th className="py-1.5 font-medium">Account</th>
                  <th className="py-1.5 font-medium">Owner</th>
                  <th className="py-1.5 font-medium">Next action</th>
                  <th className="py-1.5 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.needsAttention.map((o) => {
                  const noAction = !o.nextAction || o.nextAction.trim() === "";
                  const overdue =
                    o.nextActionDueDate && new Date(o.nextActionDueDate).getTime() < Date.now();
                  return (
                    <tr key={o.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                      <td className="py-2 font-mono text-xs">
                        <Link href={`/opportunities/${o.id}`} style={{ color: "#0073ea" }}>{o.opportunityCode}</Link>
                      </td>
                      <td className="py-2 truncate max-w-[260px]">{o.title}</td>
                      <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.account.name}</td>
                      <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.owner.name}</td>
                      <td className="py-2 text-xs" style={{ color: noAction ? "#a52840" : "#323338" }}>
                        {noAction ? "— no next action —" : o.nextAction}
                      </td>
                      <td className="py-2 text-xs" style={{ color: overdue ? "#a52840" : "#676879" }}>
                        {fmtDate(o.nextActionDueDate)}
                        {o.nextActionDueDate && (
                          <span className="ml-1.5 opacity-70">{daysFromNow(o.nextActionDueDate)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* ── Proposals awaiting follow-up (compact mini-section, optional show) ── */}
      {data.proposalMonitoring.items.length > 0 && (
        <Section
          title="Proposals awaiting follow-up"
          icon={<FileText className="w-4 h-4" />}
          link={{ href: "/proposals", label: "Open proposals →" }}
        >
          <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            <p className="text-xs mb-3" style={{ color: "#676879" }}>
              No activity logged in the last 7 days for these proposal-stage opportunities.
            </p>
            <table className="w-full text-sm">
              <thead style={{ color: "#a3a8b5" }}>
                <tr className="text-left text-xs">
                  <th className="py-1.5 font-medium">Code</th>
                  <th className="py-1.5 font-medium">Title</th>
                  <th className="py-1.5 font-medium">Stage</th>
                  <th className="py-1.5 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.proposalMonitoring.items.slice(0, 8).map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                    <td className="py-2 font-mono text-xs">
                      <Link href={`/opportunities/${o.id}`} style={{ color: "#0073ea" }}>{o.opportunityCode}</Link>
                    </td>
                    <td className="py-2 truncate max-w-[280px]">{o.title}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.stage.replace(/_/g, " ")}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.owner.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Reusable building blocks ──────────────────────────────────────────────

function Section({
  title, icon, link, children,
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

const TONE: Record<NonNullable<KpiProps["tone"]>, { value: string; }> = {
  ok:    { value: "#00854f" },
  warn:  { value: "#fdab3d" },
  alert: { value: "#a52840" },
  none:  { value: "#323338" },
};

type KpiProps = {
  label:    string;
  value:    number | string;
  caption?: string | undefined;
  tone?:    "ok" | "warn" | "alert" | "none";
  link?:    string;
};

function Kpi({ label, value, caption, tone = "none", link }: KpiProps) {
  const colour = TONE[tone].value;
  const inner = (
    <div
      className="rounded-lg bg-white p-4 transition hover:shadow-sm"
      style={{ border: "1px solid hsl(218 23% 91%)" }}
    >
      <div className="text-xs" style={{ color: "#676879" }}>{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color: colour }}>{value}</div>
      {caption && <div className="text-xs mt-0.5" style={{ color: "#a3a8b5" }}>{caption}</div>}
    </div>
  );
  return link ? <Link href={link} className="block">{inner}</Link> : inner;
}
