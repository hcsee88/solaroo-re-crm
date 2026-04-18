"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileSignature } from "lucide-react";
import { get } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

type ContractMini = {
  id: string;
  contractNo: string;
  title: string;
  status: string;
  handoverStatus: string;
  contractValue: string;
  currency: string;
};

const STATUS_COLOURS: Record<string, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  AWARDED:      "bg-green-100 text-green-700",
  SIGNED:       "bg-blue-100 text-blue-700",
  ACTIVE:       "bg-blue-100 text-blue-700",
  CLOSED:       "bg-gray-100 text-gray-500",
  DISPUTED:     "bg-red-100 text-red-700",
  TERMINATED:   "bg-red-100 text-red-700",
};

/**
 * Compact contracts panel for opportunity / account / project detail pages.
 * Pass exactly one filter prop. Shows linked contracts + a "create contract"
 * CTA prefilled with the relevant id.
 */
export function LinkedContractsSection(props: {
  opportunityId?: string;
  accountId?: string;
}) {
  const { opportunityId, accountId } = props;
  const [items, setItems] = useState<ContractMini[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "10", sortBy: "updatedAt", sortDir: "desc" });
    if (opportunityId) params.set("opportunityId", opportunityId);
    if (accountId)     params.set("accountId", accountId);
    get<PaginatedResult<ContractMini>>(`/contracts?${params}`)
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opportunityId, accountId]);

  const newContractHref = (() => {
    const p = new URLSearchParams();
    if (opportunityId) p.set("opportunityId", opportunityId);
    if (accountId)     p.set("accountId", accountId);
    const qs = p.toString();
    return qs ? `/contracts/new?${qs}` : "/contracts/new";
  })();

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileSignature className="w-4 h-4" />
          Contracts ({items.length})
        </h3>
        <Link
          href={newContractHref}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: "#0073ea" }}
        >
          <Plus className="w-3 h-3" /> New
        </Link>
      </div>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">No contracts yet.</p>
      )}
      {!loading && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="block rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
                style={{ background: "#f5f6f8" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "#0073ea" }}>
                      {c.contractNo}
                    </div>
                    <div className="text-xs truncate" style={{ color: "#676879" }}>{c.title}</div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
