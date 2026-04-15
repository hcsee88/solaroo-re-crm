"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { get } from "@/lib/api-client";
import { useRoleName } from "@/hooks/use-current-user";
import { canSeeProposalCapex, canSeeProposalMargin } from "@/lib/role-ui";
import type { PaginatedResult } from "@solaroo/types";

// ─── Local types ─────────────────────────────────────────────────────────────

type ProposalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

type ProposalListItem = {
  id: string;
  proposalCode: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  opportunity: { id: string; opportunityCode: string; title: string };
  account: { id: string; accountCode: string; name: string };
  latestVersion: {
    versionNo: number;
    approvalStatus: ProposalStatus;
    estimatedCapex: string | null;
    marginPercent: string | null;
  } | null;
  _count: { versions: number };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<ProposalStatus, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  SUBMITTED:    "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED:     "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-700",
  SUPERSEDED:   "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT:        "Draft",
  SUBMITTED:    "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED:     "Approved",
  REJECTED:     "Rejected",
  SUPERSEDED:   "Superseded",
};

const ALL_STATUSES: ProposalStatus[] = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED",
];

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[status]}`}>
      {STATUS_LABELS[status]}
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

const PAGE_SIZE = 25;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const roleName   = useRoleName();
  const showCapex  = canSeeProposalCapex(roleName);
  const showMargin = canSeeProposalMargin(roleName);

  // Base columns: Code, Title, Opportunity, Account, Status, Versions = 6
  const colCount = 6 + (showCapex ? 1 : 0) + (showMargin ? 1 : 0);

  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: "updatedAt",
        sortDir: "desc",
        ...(statusFilter && { status: statusFilter }),
      });
      const result = await get<PaginatedResult<ProposalListItem>>(
        `/proposals?${params}`
      );
      setProposals(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-muted-foreground">Commercial proposals and approval status</p>
        </div>
        <Link
          href="/proposals/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Proposal
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setStatusFilter(""); setPage(1); }}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
            statusFilter === ""
              ? "bg-primary text-primary-foreground border-transparent"
              : "border-input hover:bg-muted text-muted-foreground"
          }`}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? "" : s); setPage(1); }}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
              statusFilter === s
                ? STATUS_COLOURS[s] + " border-transparent ring-2 ring-offset-1 ring-primary"
                : "border-input hover:bg-muted text-muted-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} proposal${total !== 1 ? "s" : ""}`}
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Opportunity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                {showCapex  && <th className="px-4 py-3 text-right font-medium text-muted-foreground">CAPEX</th>}
                {showMargin && <th className="px-4 py-3 text-center font-medium text-muted-foreground">Margin</th>}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Versions</th>
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
              ) : proposals.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground">
                    {statusFilter
                      ? "No proposals match this status."
                      : "No proposals yet. Create your first one."}
                  </td>
                </tr>
              ) : (
                proposals.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.proposalCode}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/proposals/${p.id}`} className="hover:text-primary hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/opportunities/${p.opportunity.id}`}
                        className="text-xs hover:text-primary hover:underline"
                      >
                        {p.opportunity.opportunityCode}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.opportunity.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/accounts/${p.account.id}`} className="hover:text-primary hover:underline text-xs">
                        {p.account.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.latestVersion ? (
                        <StatusBadge status={p.latestVersion.approvalStatus} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {showCapex && (
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMYR(p.latestVersion?.estimatedCapex ?? null)}
                      </td>
                    )}
                    {showMargin && (
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {p.latestVersion?.marginPercent
                          ? `${parseFloat(p.latestVersion.marginPercent).toFixed(1)}%`
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                        {p._count.versions}
                      </span>
                    </td>
                  </tr>
                ))
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
