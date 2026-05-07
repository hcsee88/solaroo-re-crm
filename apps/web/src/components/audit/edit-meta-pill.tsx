"use client";

// EditMetaPill — small "Created by X · Last edited by Y" line for detail-page
// headers. Pulls data from /api/admin/audit/edit-meta which reads from the
// AuditLog table (no schema changes required on the source resource).

import { useEffect, useState } from "react";
import { get } from "@/lib/api-client";
import { timeAgo } from "@/lib/notification-utils";

type EditMeta = {
  createdBy: { id: string; name: string } | null;
  createdAt: string | null;
  lastEditedBy: { id: string; name: string } | null;
  lastEditedAt: string | null;
  lastEditedAction: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

interface EditMetaPillProps {
  /** Resource name as stored in audit_logs (e.g. "opportunity", "project", "contract"). */
  resource: string;
  /** Resource cuid. */
  resourceId: string;
  /** Optional className for the wrapper line. */
  className?: string;
}

export function EditMetaPill({ resource, resourceId, className }: EditMetaPillProps) {
  const [meta, setMeta] = useState<EditMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<EditMeta>(`/admin/audit/edit-meta?resource=${encodeURIComponent(resource)}&resourceId=${encodeURIComponent(resourceId)}`)
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        // Silent — pill is decorative; never block the page.
        if (!cancelled) setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resource, resourceId]);

  if (loading) {
    return (
      <div className={className} style={{ fontSize: 12, color: "#9aa0a6" }}>
        Loading edit history…
      </div>
    );
  }

  // No data yet — show nothing rather than a confusing empty pill.
  if (!meta || (!meta.createdBy && !meta.lastEditedBy)) {
    return null;
  }

  const sameAuthor =
    meta.createdBy && meta.lastEditedBy && meta.createdBy.id === meta.lastEditedBy.id;
  const sameMoment =
    meta.createdAt && meta.lastEditedAt && meta.createdAt === meta.lastEditedAt;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        fontSize: 12,
        color: "#676879",
        lineHeight: 1.4,
      }}
    >
      {meta.createdBy && meta.createdAt && (
        <span>
          Created by <strong style={{ color: "#323338" }}>{meta.createdBy.name}</strong>
          {" · "}
          {formatDate(meta.createdAt)}
        </span>
      )}
      {meta.lastEditedBy && meta.lastEditedAt && !(sameAuthor && sameMoment) && (
        <span>
          Last edited by <strong style={{ color: "#323338" }}>{meta.lastEditedBy.name}</strong>
          {" · "}
          {timeAgo(meta.lastEditedAt)}
        </span>
      )}
    </div>
  );
}
