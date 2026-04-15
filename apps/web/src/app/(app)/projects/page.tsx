"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { get } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectListItem = {
  id: string;
  projectNumber: number;
  projectCode: string;
  name: string;
  status: string;
  currentGateNo: number;
  startDate: string | null;
  targetCod: string | null;
  budgetBaseline: string | null;
  account: { id: string; name: string };
  projectManager: { id: string; name: string };
  _count: { gates: number; issues: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-800",
  ON_HOLD:   "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const GATE_NAMES: Record<number, string> = {
  1: "Contract Handover",
  2: "Design Freeze",
  3: "Procurement Release",
  4: "Site Execution",
  5: "Commissioning",
  6: "Financial Close Out",
};

function formatProjectNumber(n: number) {
  return `P${String(n).padStart(3, "0")}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function GatePips({ currentGateNo }: { currentGateNo: number }) {
  return (
    <div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5, 6].map((g) => {
          const done    = g < currentGateNo;
          const current = g === currentGateNo;
          return (
            <span
              key={g}
              title={`G${g}: ${GATE_NAMES[g]}`}
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                ${done    ? "bg-primary text-primary-foreground" : ""}
                ${current ? "ring-2 ring-primary bg-primary/10 text-primary" : ""}
                ${!done && !current ? "bg-muted text-muted-foreground" : ""}
              `}
            >
              {g}
            </span>
          );
        })}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        G{currentGateNo}: {GATE_NAMES[currentGateNo]}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search && { search }),
        ...(status && { status }),
      });
      const result = await get<PaginatedResult<ProjectListItem>>(`/projects?${params}`);
      setProjects(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(fetchProjects, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchProjects, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            All active and completed solar / BESS projects
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name or project code…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        {(search || status) && (
          <button
            onClick={() => { setSearch(""); setStatus(""); setPage(1); }}
            className="h-9 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} project${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">No.</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">PM</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gate Progress</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target COD</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Issues</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    {search || status
                      ? "No projects match your filters."
                      : "No projects yet. Projects are created from won opportunities."}
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-muted-foreground">
                      {formatProjectNumber(p.projectNumber)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {p.projectCode}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/projects/${p.id}`} className="hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.account.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.projectManager.name}</td>
                    <td className="px-4 py-3">
                      <GatePips currentGateNo={p.currentGateNo} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.targetCod)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {p._count.issues > 0
                        ? <span className="font-medium text-orange-600">{p._count.issues}</span>
                        : <span className="text-muted-foreground">0</span>
                      }
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
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">
                Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
