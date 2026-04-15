"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get } from "@/lib/api-client";
import { useRoleName } from "@/hooks/use-current-user";
import { canSeeOpportunityValue } from "@/lib/role-ui";
import type {
  OpportunityListItem,
  OpportunityStageValue,
  PaginatedResult,
} from "@solaroo/types";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_COLOURS,
  COMMERCIAL_MODEL_LABELS,
  OPPORTUNITY_STAGE_ORDER,
} from "@solaroo/types";

const PAGE_SIZE = 25;
const ALL_STAGES: OpportunityStageValue[] = [
  ...OPPORTUNITY_STAGE_ORDER,
  "LOST",
  "ON_HOLD",
];

function StageBadge({ stage }: { stage: OpportunityStageValue }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OPPORTUNITY_STAGE_COLOURS[stage]}`}>
      {OPPORTUNITY_STAGE_LABELS[stage]}
    </span>
  );
}

function formatMYR(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RM ${(n / 1_000).toFixed(0)}K`;
  return `RM ${n.toFixed(0)}`;
}

function NextActionCell({ opp }: { opp: OpportunityListItem }) {
  if (!opp.nextAction && !opp.nextActionDueDate) {
    return <span className="text-muted-foreground">—</span>;
  }

  const now = new Date();
  const dueDate = opp.nextActionDueDate ? new Date(opp.nextActionDueDate) : null;
  const isOverdue = dueDate && dueDate < now && opp.stage !== "WON" && opp.stage !== "LOST";
  const isDueSoon = dueDate && !isOverdue && dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return (
    <div className="max-w-[220px]">
      {opp.nextAction && (
        <p className="text-xs truncate" title={opp.nextAction}>{opp.nextAction}</p>
      )}
      {dueDate && (
        <p className={`text-xs font-medium mt-0.5 ${
          isOverdue  ? "text-red-600 dark:text-red-400" :
          isDueSoon  ? "text-orange-600 dark:text-orange-400" :
          "text-muted-foreground"
        }`}>
          {isOverdue ? "⚠ Overdue · " : isDueSoon ? "⏰ Soon · " : ""}
          {dueDate.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleName  = useRoleName();
  const showValue = canSeeOpportunityValue(roleName);
  // Base columns: Code, Title, Stage, Next Action, Account, Owner = 6; +1 for Value
  const colCount  = 6 + (showValue ? 1 : 0);

  const accountIdFilter = searchParams.get("accountId") ?? "";
  const initialOverdue  = searchParams.get("overdue") === "true";

  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<OpportunityStageValue | "">("");
  const [overdueOnly, setOverdueOnly] = useState(initialOverdue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync URL param → state on mount
  useEffect(() => {
    setOverdueOnly(searchParams.get("overdue") === "true");
  }, []);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: overdueOnly ? "nextActionDueDate" : "updatedAt",
        sortDir: "asc",
        ...(search && { search }),
        ...(stageFilter && { stage: stageFilter }),
        ...(accountIdFilter && { accountId: accountIdFilter }),
        ...(overdueOnly && { overdue: "true" }),
      });
      const result = await get<PaginatedResult<OpportunityListItem>>(
        `/opportunities?${params}`
      );
      setOpportunities(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, [page, search, stageFilter, accountIdFilter, overdueOnly]);

  useEffect(() => {
    const timer = setTimeout(fetchOpportunities, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchOpportunities, search]);

  function toggleOverdue() {
    const next = !overdueOnly;
    setOverdueOnly(next);
    setStageFilter("");
    setPage(1);
    // Update URL so browser back button works and link sharing works
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("overdue", "true");
    else url.searchParams.delete("overdue");
    router.replace(url.pathname + url.search);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = search || stageFilter || overdueOnly;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            {overdueOnly
              ? "Showing opportunities with overdue next actions"
              : "Commercial pipeline"}
          </p>
        </div>
        <Link
          href="/opportunities/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Opportunity
        </Link>
      </div>

      {/* Overdue alert banner */}
      {overdueOnly && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3">
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            ⚠ Overdue filter active — showing only opportunities with a missed next action deadline
          </span>
          <button
            onClick={toggleOverdue}
            className="ml-auto text-xs text-red-600 dark:text-red-400 underline hover:no-underline flex-shrink-0"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Pipeline stage filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
        {/* Overdue pill — first, most prominent */}
        <button
          onClick={toggleOverdue}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
            overdueOnly
              ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 ring-2 ring-offset-1 ring-red-400"
              : "border-input hover:bg-muted text-muted-foreground"
          }`}
        >
          ⚠ Overdue
        </button>

        {/* Stage pills — disabled when overdue filter is on */}
        {OPPORTUNITY_STAGE_ORDER.map((stage) => (
          <button
            key={stage}
            disabled={overdueOnly}
            onClick={() => {
              setStageFilter(stageFilter === stage ? "" : stage);
              setPage(1);
            }}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
              overdueOnly ? "opacity-30 cursor-not-allowed border-input text-muted-foreground" :
              stageFilter === stage
                ? OPPORTUNITY_STAGE_COLOURS[stage] + " border-transparent ring-2 ring-offset-1 ring-primary"
                : "border-input hover:bg-muted text-muted-foreground"
            }`}
          >
            {OPPORTUNITY_STAGE_LABELS[stage]}
          </button>
        ))}
        <button
          disabled={overdueOnly}
          onClick={() => { setStageFilter(stageFilter === "LOST" ? "" : "LOST"); setPage(1); }}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
            overdueOnly ? "opacity-30 cursor-not-allowed border-input text-muted-foreground" :
            stageFilter === "LOST" ? OPPORTUNITY_STAGE_COLOURS["LOST"] + " border-transparent" : "border-input hover:bg-muted text-muted-foreground"
          }`}
        >
          Lost
        </button>
        <button
          disabled={overdueOnly}
          onClick={() => { setStageFilter(stageFilter === "ON_HOLD" ? "" : "ON_HOLD"); setPage(1); }}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
            overdueOnly ? "opacity-30 cursor-not-allowed border-input text-muted-foreground" :
            stageFilter === "ON_HOLD" ? OPPORTUNITY_STAGE_COLOURS["ON_HOLD"] + " border-transparent" : "border-input hover:bg-muted text-muted-foreground"
          }`}
        >
          On Hold
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search opportunities…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setStageFilter(""); setOverdueOnly(false); setPage(1); router.replace("/opportunities"); }}
            className="h-9 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear all
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} opportunit${total !== 1 ? "ies" : "y"}`}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                {showValue && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : opportunities.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground">
                    {overdueOnly
                      ? "No overdue next actions. All active opportunities are on track."
                      : search || stageFilter
                      ? "No opportunities match your filters."
                      : "No opportunities yet. Create your first one."}
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => {
                  const dueDate = opp.nextActionDueDate ? new Date(opp.nextActionDueDate) : null;
                  const isOverdue = dueDate && dueDate < new Date() && opp.stage !== "WON" && opp.stage !== "LOST";
                  return (
                    <tr
                      key={opp.id}
                      className={`border-b transition-colors ${
                        isOverdue ? "bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{opp.opportunityCode}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/opportunities/${opp.id}`} className="hover:text-primary hover:underline">
                          {opp.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{opp.site.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StageBadge stage={opp.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <NextActionCell opp={opp} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/accounts/${opp.account.id}`} className="hover:text-primary hover:underline">
                          {opp.account.name}
                        </Link>
                      </td>
                      {showValue && (
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatMYR(opp.estimatedValue)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {opp.owner.name}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
