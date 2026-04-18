"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Plus, FileSignature } from "lucide-react";
import { get } from "@/lib/api-client";
import { SavedViewsBar } from "@/components/saved-views/saved-views-bar";
import type { PaginatedResult } from "@solaroo/types";

// ─── Local types ─────────────────────────────────────────────────────────────

type ContractStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "AWARDED"
  | "SIGNED"
  | "ACTIVE"
  | "CLOSED"
  | "DISPUTED"
  | "TERMINATED";

type HandoverStatus = "NOT_STARTED" | "READY" | "IN_PROGRESS" | "COMPLETED";

type ContractListItem = {
  id: string;
  contractNo: string;
  title: string;
  status: ContractStatus;
  handoverStatus: HandoverStatus;
  contractValue: string;
  currency: string;
  awardedDate: string | null;
  targetCod: string | null;
  createdAt: string;
  updatedAt: string;
  account: { id: string; accountCode: string; name: string };
  opportunity: { id: string; opportunityCode: string; title: string } | null;
  project: { id: string; projectCode: string } | null;
  projectManagerCandidate: { id: string; name: string } | null;
};

// ─── Visual helpers ──────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<ContractStatus, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  AWARDED:      "bg-green-100 text-green-700",
  SIGNED:       "bg-blue-100 text-blue-700",
  ACTIVE:       "bg-blue-100 text-blue-700",
  CLOSED:       "bg-gray-100 text-gray-500",
  DISPUTED:     "bg-red-100 text-red-700",
  TERMINATED:   "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT:        "Draft",
  UNDER_REVIEW: "Under Review",
  AWARDED:      "Awarded",
  SIGNED:       "Signed",
  ACTIVE:       "Active",
  CLOSED:       "Closed",
  DISPUTED:     "Disputed",
  TERMINATED:   "Terminated",
};

const HANDOVER_COLOURS: Record<HandoverStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-600",
  READY:       "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED:   "bg-green-100 text-green-700",
};

const HANDOVER_LABELS: Record<HandoverStatus, string> = {
  NOT_STARTED: "Not started",
  READY:       "Ready",
  IN_PROGRESS: "In progress",
  COMPLETED:   "Completed",
};

const ALL_STATUSES: ContractStatus[] = [
  "DRAFT", "UNDER_REVIEW", "AWARDED", "SIGNED", "ACTIVE", "CLOSED", "DISPUTED", "TERMINATED",
];

function StatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function HandoverBadge({ status }: { status: HandoverStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${HANDOVER_COLOURS[status]}`}>
      {HANDOVER_LABELS[status]}
    </span>
  );
}

function formatMoney(val: string | null, currency: string): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${n.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
}

const PAGE_SIZE = 25;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [statusFilter, setStatusFilter]   = useState<ContractStatus | "">("");
  const [handoverFilter, setHandoverFilter] = useState<HandoverStatus | "">("");
  const [search, setSearch]               = useState("");
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: "updatedAt",
        sortDir: "desc",
        ...(statusFilter   && { status: statusFilter }),
        ...(handoverFilter && { handoverStatus: handoverFilter }),
        ...(search         && { search }),
      });
      const result = await get<PaginatedResult<ContractListItem>>(`/contracts?${params}`);
      setContracts(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, handoverFilter, search]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Contracts</h1>
          <p className="text-sm mt-1" style={{ color: "#676879" }}>
            Awarded commercial work and the bridge to project execution.
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: "#0073ea" }}
        >
          <Plus className="w-4 h-4" />
          New contract
        </Link>
      </div>

      {/* Saved views — apply/save personal filter sets */}
      <SavedViewsBar
        module="contracts"
        currentFilters={{ status: statusFilter, handoverStatus: handoverFilter, search }}
        onApply={(f) => {
          setStatusFilter((f.status as ContractStatus | "") ?? "");
          setHandoverFilter((f.handoverStatus as HandoverStatus | "") ?? "");
          setSearch((f.search as string) ?? "");
          setPage(1);
        }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search code or title…"
          className="rounded-md border bg-white px-3 py-1.5 text-sm w-64"
          style={{ borderColor: "hsl(218 23% 91%)" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ContractStatus | ""); setPage(1); }}
          className="rounded-md border bg-white px-3 py-1.5 text-sm"
          style={{ borderColor: "hsl(218 23% 91%)" }}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select
          value={handoverFilter}
          onChange={(e) => { setHandoverFilter(e.target.value as HandoverStatus | ""); setPage(1); }}
          className="rounded-md border bg-white px-3 py-1.5 text-sm"
          style={{ borderColor: "hsl(218 23% 91%)" }}
        >
          <option value="">All handover states</option>
          {(["NOT_STARTED", "READY", "IN_PROGRESS", "COMPLETED"] as HandoverStatus[]).map((s) => (
            <option key={s} value={s}>Handover · {HANDOVER_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white overflow-hidden" style={{ border: "1px solid hsl(218 23% 91%)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#f5f6f8", color: "#676879" }}>
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Contract</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Opportunity</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Awarded</th>
              <th className="px-4 py-2 font-medium">Target COD</th>
              <th className="px-4 py-2 font-medium">PM</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Handover</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: "#676879" }}>Loading…</td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            )}
            {!loading && !error && contracts.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12">
                <div className="flex flex-col items-center gap-2">
                  <FileSignature className="w-8 h-8" style={{ color: "hsl(218 23% 80%)" }} />
                  <p className="text-sm" style={{ color: "#676879" }}>No contracts yet.</p>
                  <Link href="/contracts/new" className="text-sm font-medium" style={{ color: "#0073ea" }}>
                    Create the first one →
                  </Link>
                </div>
              </td></tr>
            )}
            {!loading && !error && contracts.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                <td className="px-4 py-2.5">
                  <Link href={`/contracts/${c.id}`} className="font-medium" style={{ color: "#0073ea" }}>
                    {c.contractNo}
                  </Link>
                  <div className="text-xs" style={{ color: "#676879" }}>{c.title}</div>
                </td>
                <td className="px-4 py-2.5" style={{ color: "#323338" }}>{c.account.name}</td>
                <td className="px-4 py-2.5">
                  {c.opportunity ? (
                    <Link href={`/opportunities/${c.opportunity.id}`} style={{ color: "#0073ea" }}>
                      {c.opportunity.opportunityCode}
                    </Link>
                  ) : (
                    <span style={{ color: "#a3a8b5" }}>—</span>
                  )}
                </td>
                <td className="px-4 py-2.5" style={{ color: "#323338" }}>{formatMoney(c.contractValue, c.currency)}</td>
                <td className="px-4 py-2.5" style={{ color: "#676879" }}>{formatDate(c.awardedDate)}</td>
                <td className="px-4 py-2.5" style={{ color: "#676879" }}>{formatDate(c.targetCod)}</td>
                <td className="px-4 py-2.5" style={{ color: "#676879" }}>
                  {c.projectManagerCandidate?.name ?? <span style={{ color: "#a3a8b5" }}>—</span>}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2.5">
                  <HandoverBadge status={c.handoverStatus} />
                  {c.project && (
                    <Link href={`/projects/${c.project.id}`} className="block text-xs mt-1" style={{ color: "#0073ea" }}>
                      → {c.project.projectCode}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs" style={{ color: "#676879" }}>
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              style={{ borderColor: "hsl(218 23% 91%)", background: "#fff", color: "#323338" }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              style={{ borderColor: "hsl(218 23% 91%)", background: "#fff", color: "#323338" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
