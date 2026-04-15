"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { get } from "@/lib/api-client";
import type { SiteListItem, SiteGridCategory, PaginatedResult } from "@solaroo/types";
import { SITE_GRID_CATEGORY_LABELS, SITE_GRID_CATEGORY_COLOURS } from "@solaroo/types";

const PAGE_SIZE = 25;
const GRID_CATEGORIES: SiteGridCategory[] = ["OFF_GRID", "WEAK_GRID", "GRID_CONNECTED", "HYBRID"];

function GridBadge({ category }: { category: SiteGridCategory }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SITE_GRID_CATEGORY_COLOURS[category]}`}>
      {SITE_GRID_CATEGORY_LABELS[category]}
    </span>
  );
}

export default function SitesPage() {
  const searchParams = useSearchParams();
  const accountIdFilter = searchParams.get("accountId") ?? "";

  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [gridFilter, setGridFilter] = useState<SiteGridCategory | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(search && { search }),
        ...(gridFilter && { gridCategory: gridFilter }),
        ...(accountIdFilter && { accountId: accountIdFilter }),
      });
      const result = await get<PaginatedResult<SiteListItem>>(`/sites?${params}`);
      setSites(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }, [page, search, gridFilter, accountIdFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchSites, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchSites, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const newSiteHref = accountIdFilter ? `/sites/new?accountId=${accountIdFilter}` : "/sites/new";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground">Project and customer sites</p>
        </div>
        <Link
          href={newSiteHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Site
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search sites…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={gridFilter}
          onChange={(e) => { setGridFilter(e.target.value as SiteGridCategory | ""); setPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All grid types</option>
          {GRID_CATEGORIES.map((g) => (
            <option key={g} value={g}>{SITE_GRID_CATEGORY_LABELS[g]}</option>
          ))}
        </select>
        {(search || gridFilter) && (
          <button
            onClick={() => { setSearch(""); setGridFilter(""); setPage(1); }}
            className="h-9 rounded-md border border-input px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} site${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Grid Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Region</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Opps</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Projects</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
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
              ) : sites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {search || gridFilter ? "No sites match your filters." : "No sites yet. Add your first site."}
                  </td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{site.siteCode}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/sites/${site.id}`} className="hover:text-primary hover:underline">
                        {site.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <GridBadge category={site.gridCategory} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/accounts/${site.account.id}`} className="text-sm hover:text-primary hover:underline">
                        {site.account.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{site.region ?? "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{site._count.opportunities}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{site._count.projects}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${site.isActive ? "bg-green-500" : "bg-gray-300"}`} />
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
