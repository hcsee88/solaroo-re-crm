"use client";

import { Bell, X, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { get, patch } from "@/lib/api-client";
import { getAccentColor, timeAgo } from "@/lib/notification-utils";

// ─── Digest opt-in toggle ─────────────────────────────────────────────────────

function DigestToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    get<{ notificationDigestEnabled: boolean }>("/auth/me")
      .then((u) => setEnabled(!!u.notificationDigestEnabled))
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    setBusy(true);
    try {
      const r = await patch<{ notificationDigestEnabled: boolean }>(
        "/auth/me/preferences",
        { notificationDigestEnabled: !enabled },
      );
      setEnabled(r.notificationDigestEnabled);
    } catch { /* silent */ }
    finally { setBusy(false); }
  }

  if (enabled === null) return null;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title="Get a daily summary of unread notifications"
      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
      style={{
        color:      enabled ? "#00854f" : "#676879",
        background: enabled ? "hsl(146 65% 92%)" : "#f5f6f8",
        border:     "1px solid " + (enabled ? "#00ca72" : "hsl(218 23% 91%)"),
      }}
    >
      Daily digest: {enabled ? "ON" : "OFF"}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationStatus = "UNREAD" | "READ" | "DISMISSED";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  status: NotificationStatus;
  linkUrl: string | null;
  resource: string | null;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
};

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResult<NotificationItem> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await get<PaginatedResult<NotificationItem>>(
        `/notifications/paginated?page=${p}&pageSize=${PAGE_SIZE}&includeDismissed=true`,
      );
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function markRead(id: string, linkUrl: string | null) {
    try {
      await patch(`/notifications/${id}/read`, {});
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) =>
                n.id === id ? { ...n, status: "READ" } : n,
              ),
            }
          : prev,
      );
    } catch { /* silent */ }
    if (linkUrl) router.push(linkUrl);
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await patch(`/notifications/${id}/dismiss`, {});
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) =>
                n.id === id ? { ...n, status: "DISMISSED" } : n,
              ),
            }
          : prev,
      );
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      await patch("/notifications/read-all", {});
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) =>
                n.status === "UNREAD" ? { ...n, status: "READ" } : n,
              ),
            }
          : prev,
      );
    } catch { /* silent */ }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const hasUnreadOnPage = items.some((n) => n.status === "UNREAD");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#323338" }}>
            Notifications
          </h1>
          <p className="text-sm mt-1" style={{ color: "#676879" }}>
            {total === 0
              ? "No notifications yet"
              : `${total} total ${total === 1 ? "notification" : "notifications"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DigestToggle />
        {hasUnreadOnPage && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            style={{ color: "#0073ea", background: "hsl(213 100% 96%)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(213 100% 92%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(213 100% 96%)";
            }}
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
        </div>
      </div>

      {/* List card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid hsl(218 23% 91%)",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(26,26,67,0.04)",
        }}
      >
        {loading && (
          <div
            className="flex items-center justify-center py-16 text-sm"
            style={{ color: "#676879" }}
          >
            Loading…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell className="w-10 h-10" style={{ color: "hsl(218 23% 88%)" }} />
            <p className="text-sm" style={{ color: "#676879" }}>
              You&apos;re all caught up
            </p>
          </div>
        )}

        {!loading &&
          items.map((n) => {
            const accent = getAccentColor(n.type);
            const isUnread = n.status === "UNREAD";
            const isDismissed = n.status === "DISMISSED";

            return (
              <div
                key={n.id}
                onClick={() => !isDismissed && markRead(n.id, n.linkUrl)}
                className="relative group flex items-start gap-3 px-5 py-4 transition-colors"
                style={{
                  background: isUnread ? "hsl(213 100% 98%)" : "transparent",
                  borderBottom: "1px solid hsl(218 23% 93%)",
                  cursor: isDismissed ? "default" : "pointer",
                  opacity: isDismissed ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (isDismissed) return;
                  (e.currentTarget as HTMLElement).style.background = isUnread
                    ? "hsl(213 100% 96%)"
                    : "hsl(228 33% 97%)";
                }}
                onMouseLeave={(e) => {
                  if (isDismissed) return;
                  (e.currentTarget as HTMLElement).style.background = isUnread
                    ? "hsl(213 100% 98%)"
                    : "transparent";
                }}
              >
                {/* Accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
                  style={{ background: isUnread ? accent : "transparent" }}
                />

                {/* Dot */}
                <div className="flex-shrink-0 mt-1.5">
                  {isUnread ? (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: accent }}
                    />
                  ) : (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: "hsl(218 23% 88%)" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-8">
                  <p
                    className="text-sm leading-snug"
                    style={{
                      color: isUnread ? "#323338" : "#676879",
                      fontWeight: isUnread ? 600 : 400,
                    }}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: "#676879" }}
                    >
                      {n.body}
                    </p>
                  )}
                  <p
                    className="text-xs mt-1.5"
                    style={{ color: "hsl(218 23% 70%)" }}
                  >
                    {timeAgo(n.createdAt)}
                    {isDismissed && " · dismissed"}
                  </p>
                </div>

                {/* Dismiss button */}
                {!isDismissed && (
                  <button
                    onClick={(e) => dismiss(n.id, e)}
                    className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{ color: "#676879" }}
                    onMouseEnter={(e2) => {
                      (e2.currentTarget as HTMLElement).style.background =
                        "hsl(218 23% 91%)";
                    }}
                    onMouseLeave={(e2) => {
                      (e2.currentTarget as HTMLElement).style.background = "";
                    }}
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: "#676879" }}>
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: "#323338",
                border: "1px solid hsl(218 23% 91%)",
                background: "#fff",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: "#323338",
                border: "1px solid hsl(218 23% 91%)",
                background: "#fff",
              }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
