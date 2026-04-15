"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { get } from "@/lib/api-client";
import type {
  AccountListItem,
  AccountType,
  PaginatedResult,
} from "@solaroo/types";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLOURS } from "@solaroo/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ type }: { type: AccountType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_TYPE_COLOURS[type]}`}
    >
      {ACCOUNT_TYPE_LABELS[type]}
    </span>
  );
}

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`}
      title={active ? "Active" : "Inactive"}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const ACCOUNT_TYPES: AccountType[] = [
  "CLIENT",
  "PROSPECT",
  "PARTNER",
  "CONSULTANT",
  "VENDOR",
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
      });
      const result = await get<PaginatedResult<AccountListItem>>(
        `/accounts?${params}`
      );
      setAccounts(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchAccounts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchAccounts, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Clients, prospects, partners and consultants
          </p>
        </div>
        <Link
          href="/accounts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Account
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as AccountType | "");
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {(search || typeFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setPage(1);
            }}
            className="h-9 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} account${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Error */}
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Code
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Industry
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Region
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Sites
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Opps
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {search || typeFilter
                      ? "No accounts match your filters."
                      : "No accounts yet. Create your first account."}
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="border-b transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {acc.accountCode}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/accounts/${acc.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {acc.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge type={acc.type} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {acc.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {acc.region ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {acc._count.sites}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {acc._count.opportunities}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActiveDot active={acc.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
