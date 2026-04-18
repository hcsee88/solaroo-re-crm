"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { get } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

export type AuditEntry = {
  id: string;
  resource: string;
  resourceId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  performedAt: string;
  user: { id: string; name: string } | null;
};

const ACTION_COLOURS: Record<string, string> = {
  status_changed:        "bg-blue-100 text-blue-700",
  stage_changed:         "bg-blue-100 text-blue-700",
  approved:              "bg-green-100 text-green-700",
  rejected:              "bg-red-100 text-red-700",
  handover_ready:        "bg-amber-100 text-amber-700",
  handover_started:      "bg-blue-100 text-blue-700",
  handover_completed:    "bg-green-100 text-green-700",
  member_added:          "bg-blue-100 text-blue-700",
  member_removed:        "bg-gray-100 text-gray-700",
  blocker_owner_assigned:"bg-amber-100 text-amber-700",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

function summarise(e: AuditEntry): string {
  if (e.field && e.oldValue !== null && e.newValue !== null) {
    return `${e.field}: ${e.oldValue} → ${e.newValue}`;
  }
  if (e.field && e.newValue !== null) return `${e.field} → ${e.newValue}`;
  if (e.metadata && typeof e.metadata === "object") {
    const m = e.metadata as Record<string, unknown>;
    const compact = Object.entries(m)
      .filter(([, v]) => v != null && typeof v !== "object")
      .map(([k, v]) => `${k}: ${String(v)}`)
      .slice(0, 3)
      .join(" · ");
    if (compact) return compact;
  }
  return "";
}

/**
 * Embeddable audit trail. Pass either { resource, resourceId } for a per-record
 * trail, or no props for a global feed (admin page). Silently hides if the
 * caller lacks audit_log:view permission.
 */
export function AuditTrail({
  resource,
  resourceId,
  userId,
  from,
  to,
  pageSize = 25,
  showResource = false,
}: {
  resource?: string | undefined;
  resourceId?: string | undefined;
  userId?: string | undefined;
  from?: string | undefined;   // ISO date or yyyy-mm-dd
  to?: string | undefined;
  pageSize?: number | undefined;
  /** Show the resource:resourceId column — useful in the global feed. */
  showResource?: boolean | undefined;
}) {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(resource   && { resource }),
      ...(resourceId && { resourceId }),
      ...(userId     && { userId }),
      ...(from       && { from }),
      ...(to         && { to }),
    });
    get<PaginatedResult<AuditEntry>>(`/admin/audit?${params}`)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) setForbidden(true);
      })
      .finally(() => setLoading(false));
  }, [resource, resourceId, userId, from, to, page, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [resource, resourceId, userId, from, to]);

  if (forbidden) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#676879" }}>
        <History className="w-3.5 h-3.5" /> Audit trail ({total})
      </h3>

      {loading && <p className="text-sm" style={{ color: "#676879" }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm" style={{ color: "#676879" }}>No audit entries.</p>
      )}

      {!loading && items.length > 0 && (
        <>
          <ul className="space-y-2">
            {items.map((e) => {
              const accent = ACTION_COLOURS[e.action] ?? "bg-gray-100 text-gray-700";
              const summary = summarise(e);
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0" style={{ borderColor: "hsl(218 23% 93%)" }}>
                  <span className="text-xs whitespace-nowrap" style={{ color: "#a3a8b5", minWidth: "120px" }}>
                    {formatTime(e.performedAt)}
                  </span>
                  <span className={`flex-shrink-0 text-xs font-medium rounded-full px-2 py-0.5 ${accent}`}>
                    {e.action.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    {showResource && (
                      <div className="text-xs" style={{ color: "#676879" }}>
                        <Link
                          href={resourceLink(e.resource, e.resourceId)}
                          className="hover:underline"
                          style={{ color: "#0073ea" }}
                        >
                          {e.resource}/{e.resourceId.slice(0, 10)}
                        </Link>
                      </div>
                    )}
                    {summary && (
                      <div className="text-xs mt-0.5" style={{ color: "#323338" }}>{summary}</div>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap" style={{ color: "#676879" }}>
                    {e.user?.name ?? "(system)"}
                  </span>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs mt-3" style={{ color: "#676879" }}>
              <span>Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                  style={{ borderColor: "hsl(218 23% 91%)", background: "#fff" }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                  style={{ borderColor: "hsl(218 23% 91%)", background: "#fff" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Map (resource, resourceId) → app-internal link for the global audit feed. */
function resourceLink(resource: string, resourceId: string): string {
  switch (resource) {
    case "contract":          return `/contracts/${resourceId}`;
    case "opportunity":       return `/opportunities/${resourceId}`;
    case "project":           return `/projects/${resourceId}`;
    case "project_gate":      return `/projects/${resourceId.split(":")[0]}`;
    case "gate_deliverable":  return `#`; // no canonical page; deliverables live inside project gates
    case "purchase_order":    return `/procurement/purchase-orders/${resourceId}`;
    case "document_revision": return `#`;
    case "invoice":           return `#`;
    default:                  return `#`;
  }
}
