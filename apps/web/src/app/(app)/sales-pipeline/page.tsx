"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TrendingUp, AlertCircle, Clock, FileText, Target, Trophy, Users, ExternalLink,
} from "lucide-react";
import { get } from "@/lib/api-client";

type SalesPipelineMetrics = {
  pipelineSummary: {
    totalActiveOpportunities: number;
    totalPipelineValue: number;
    weightedPipelineValue: number;
    averageDealSize: number;
  };
  stageBreakdown: { stage: string; count: number; value: number }[];
  activitySummary: {
    totalActivitiesThisWeek: number;
    byOwner: { userId: string; name: string; count: number }[];
  };
  followUpMonitoring: {
    overdueNextActions: number;
    noNextAction: number;
    staleOpportunities30d: number;
    staleOpportunities14d: number;
  };
  proposalMonitoring: { proposalsAwaitingFollowup: number };
  closingForecast: {
    thisMonthCount: number;
    thisMonthValue: number;
    thisQuarterCount: number;
    thisMonthList: {
      id: string; opportunityCode: string; title: string; stage: string;
      estimatedValue: string | null; probabilityPercent: number | null;
      expectedAwardDate: string | null;
      owner: { id: string; name: string };
      account: { id: string; name: string };
    }[];
  };
  topOpportunities: {
    id: string; opportunityCode: string; title: string; stage: string;
    estimatedValue: string | null; probabilityPercent: number | null;
    expectedAwardDate: string | null;
    owner: { id: string; name: string };
    account: { id: string; name: string };
  }[];
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

export default function SalesPipelinePage() {
  const [data, setData] = useState<SalesPipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<SalesPipelineMetrics>("/reporting/sales-pipeline")
      .then(setData)
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6" style={{ color: "#0073ea" }} />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Sales Pipeline</h1>
            <p className="text-sm mt-1" style={{ color: "#676879" }}>
              Sales execution discipline. Pipeline health, activity, follow-ups, and forecast.
            </p>
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: "#a3a8b5" }}>
          As of {new Date(data.generatedAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </div>

      {/* ── Pipeline Summary ───────────────────────────────────────────── */}
      <Section title="Pipeline summary" icon={<TrendingUp className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Active opportunities" value={data.pipelineSummary.totalActiveOpportunities} />
          <Kpi label="Total pipeline value" value={fmt(data.pipelineSummary.totalPipelineValue)} colour="#0073ea" />
          <Kpi label="Weighted (× probability)" value={fmt(data.pipelineSummary.weightedPipelineValue)} colour="#a25ddc" />
          <Kpi label="Average deal size" value={fmt(data.pipelineSummary.averageDealSize)} />
        </div>
      </Section>

      {/* ── Stage Breakdown ────────────────────────────────────────────── */}
      <Section title="By stage" icon={<TrendingUp className="w-4 h-4" />} link={{ href: "/opportunities", label: "Open opportunities →" }}>
        <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          <table className="w-full text-sm">
            <thead style={{ color: "#a3a8b5" }}>
              <tr className="text-left text-xs">
                <th className="py-1.5 font-medium">Stage</th>
                <th className="py-1.5 font-medium text-right">Count</th>
                <th className="py-1.5 font-medium text-right">Value</th>
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
                    <td className="py-2 text-right" style={{ color: "#676879" }}>{count > 0 ? fmt(row?.value ?? 0) : "—"}</td>
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

      {/* ── Sales Activity Summary ─────────────────────────────────────── */}
      <Section title="Sales activity (last 7 days)" icon={<Users className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Kpi label="Activities this week" value={data.activitySummary.totalActivitiesThisWeek} colour="#0073ea" />
          <div className="md:col-span-2 rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#676879" }}>By salesperson</h3>
            {data.activitySummary.byOwner.length === 0 ? (
              <p className="text-sm" style={{ color: "#676879" }}>No activity logged this week.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.activitySummary.byOwner.slice(0, 8).map((u) => {
                  const max = Math.max(1, ...data.activitySummary.byOwner.map((x) => x.count));
                  const pct = (u.count / max) * 100;
                  return (
                    <li key={u.userId} className="flex items-center gap-3 text-sm">
                      <span className="w-32 truncate" style={{ color: "#323338" }}>{u.name}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: "hsl(218 23% 93%)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#0073ea" }} />
                      </div>
                      <span className="w-8 text-right text-xs" style={{ color: "#676879" }}>{u.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* ── Follow-up Monitoring ───────────────────────────────────────── */}
      <Section title="Follow-up monitoring" icon={<AlertCircle className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Overdue next actions"   value={data.followUpMonitoring.overdueNextActions}    colour={data.followUpMonitoring.overdueNextActions > 0 ? "#a52840" : "#00854f"} />
          <Kpi label="No next action"         value={data.followUpMonitoring.noNextAction}          colour={data.followUpMonitoring.noNextAction > 0 ? "#fdab3d" : "#00854f"} />
          <Kpi label="Stale 14+ days"         value={data.followUpMonitoring.staleOpportunities14d} colour={data.followUpMonitoring.staleOpportunities14d > 0 ? "#fdab3d" : "#00854f"} />
          <Kpi label="Stale 30+ days"         value={data.followUpMonitoring.staleOpportunities30d} colour={data.followUpMonitoring.staleOpportunities30d > 0 ? "#a52840" : "#00854f"} />
        </div>
      </Section>

      {/* ── Proposal Monitoring ────────────────────────────────────────── */}
      <Section title="Proposal monitoring" icon={<FileText className="w-4 h-4" />} link={{ href: "/proposals", label: "Open proposals →" }}>
        <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          <Kpi label="Proposals sent · no follow-up in 3+ days" value={data.proposalMonitoring.proposalsAwaitingFollowup} colour={data.proposalMonitoring.proposalsAwaitingFollowup > 0 ? "#a52840" : "#00854f"} />
        </div>
      </Section>

      {/* ── Closing Forecast ───────────────────────────────────────────── */}
      <Section title="Closing forecast" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Kpi label="Closing this month"    value={data.closingForecast.thisMonthCount}   caption={fmt(data.closingForecast.thisMonthValue)} colour="#0073ea" />
          <Kpi label="Closing this quarter"  value={data.closingForecast.thisQuarterCount} colour="#a25ddc" />
          <Kpi label="Won this month"        value={data.wonThisMonth.count}               caption={fmt(data.wonThisMonth.value)} colour="#00854f" />
        </div>
        {data.closingForecast.thisMonthList.length > 0 && (
          <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#676879" }}>Closing this month</h3>
            <table className="w-full text-sm">
              <thead style={{ color: "#a3a8b5" }}>
                <tr className="text-left text-xs">
                  <th className="py-1.5 font-medium">Code</th>
                  <th className="py-1.5 font-medium">Title</th>
                  <th className="py-1.5 font-medium">Account</th>
                  <th className="py-1.5 font-medium">Owner</th>
                  <th className="py-1.5 font-medium text-right">Value</th>
                  <th className="py-1.5 font-medium text-right">Prob.</th>
                  <th className="py-1.5 font-medium">Expected</th>
                </tr>
              </thead>
              <tbody>
                {data.closingForecast.thisMonthList.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                    <td className="py-2 font-mono text-xs"><Link href={`/opportunities/${o.id}`} style={{ color: "#0073ea" }}>{o.opportunityCode}</Link></td>
                    <td className="py-2 truncate max-w-[280px]">{o.title}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.account.name}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.owner.name}</td>
                    <td className="py-2 text-right">{fmt(Number(o.estimatedValue ?? 0))}</td>
                    <td className="py-2 text-right text-xs" style={{ color: "#676879" }}>{o.probabilityPercent ?? "—"}%</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{fmtDate(o.expectedAwardDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Top 10 ─────────────────────────────────────────────────────── */}
      <Section title="Top 10 opportunities by value" icon={<Trophy className="w-4 h-4" />}>
        <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
          {data.topOpportunities.length === 0 ? (
            <p className="text-sm" style={{ color: "#676879" }}>No opportunities yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ color: "#a3a8b5" }}>
                <tr className="text-left text-xs">
                  <th className="py-1.5 font-medium">Code</th>
                  <th className="py-1.5 font-medium">Title</th>
                  <th className="py-1.5 font-medium">Stage</th>
                  <th className="py-1.5 font-medium">Owner</th>
                  <th className="py-1.5 font-medium text-right">Value</th>
                  <th className="py-1.5 font-medium text-right">Prob.</th>
                </tr>
              </thead>
              <tbody>
                {data.topOpportunities.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                    <td className="py-2 font-mono text-xs"><Link href={`/opportunities/${o.id}`} style={{ color: "#0073ea" }}>{o.opportunityCode}</Link></td>
                    <td className="py-2 truncate max-w-[300px]">{o.title}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.stage.replace(/_/g, " ")}</td>
                    <td className="py-2 text-xs" style={{ color: "#676879" }}>{o.owner.name}</td>
                    <td className="py-2 text-right">{fmt(Number(o.estimatedValue ?? 0))}</td>
                    <td className="py-2 text-right text-xs" style={{ color: "#676879" }}>{o.probabilityPercent ?? "—"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Reusable building blocks (mirror /reports patterns) ────────────────────

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

function Kpi({ label, value, caption, colour = "#323338" }: { label: string; value: number | string; caption?: string; colour?: string }) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="text-xs" style={{ color: "#676879" }}>{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color: colour }}>{value}</div>
      {caption && <div className="text-xs mt-0.5" style={{ color: "#a3a8b5" }}>{caption}</div>}
    </div>
  );
}
