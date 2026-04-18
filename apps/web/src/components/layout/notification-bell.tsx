"use client";

import { Bell, X, Check, CheckCheck } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { get, patch } from "@/lib/api-client";
import { getAccentColor, timeAgo } from "@/lib/notification-utils";

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

// ─── Notification Bell ────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Poll unread count every 30 s ─────────────────────────────────────────

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(res.count);
    } catch {
      // silent — network hiccup should not break UI
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // ── Load full list when panel opens ──────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const items = await get<NotificationItem[]>("/notifications");
      setNotifications(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // ── Close panel on outside click ──────────────────────────────────────────

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function markRead(id: string, linkUrl: string | null) {
    try {
      await patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
    if (linkUrl) {
      setOpen(false);
      router.push(linkUrl);
    }
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await patch(`/notifications/${id}/dismiss`, {});
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => {
        const n = notifications.find((x) => x.id === id);
        return n?.status === "UNREAD" ? Math.max(0, c - 1) : c;
      });
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      await patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "READ" as NotificationStatus })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }

  const unread = notifications.filter((n) => n.status === "UNREAD");
  const visible = notifications.filter((n) => n.status !== "DISMISSED").slice(0, 30);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{ color: "#676879" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 94%)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = open ? "hsl(228 33% 94%)" : "";
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full border-2 border-white flex items-center justify-center text-white"
            style={{ background: "#e2445c", fontSize: "9px", fontWeight: 700, lineHeight: 1, padding: "0 3px" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] rounded-xl overflow-hidden z-50"
          style={{
            boxShadow: "0 8px 32px rgba(26,26,67,0.18)",
            border: "1px solid hsl(218 23% 91%)",
            background: "#fff",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid hsl(218 23% 91%)" }}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: "#323338" }}>Notifications</h3>
              {unread.length > 0 && (
                <span
                  className="text-xs font-semibold rounded-full px-1.5 py-0.5"
                  style={{ background: "hsl(213 100% 95%)", color: "#0073ea" }}
                >
                  {unread.length} new
                </span>
              )}
            </div>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "#0073ea" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#0060c0"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#0073ea"; }}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "440px" }}>
            {loading && (
              <div className="flex items-center justify-center py-10 text-sm" style={{ color: "#676879" }}>
                Loading…
              </div>
            )}

            {!loading && visible.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-8 h-8" style={{ color: "hsl(218 23% 88%)" }} />
                <p className="text-sm" style={{ color: "#676879" }}>You&apos;re all caught up</p>
              </div>
            )}

            {!loading && visible.map((n) => {
              const accent = getAccentColor(n.type);
              const isUnread = n.status === "UNREAD";

              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id, n.linkUrl)}
                  className="relative group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    background: isUnread ? "hsl(213 100% 98%)" : "transparent",
                    borderBottom: "1px solid hsl(218 23% 93%)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isUnread ? "hsl(213 100% 96%)" : "hsl(228 33% 97%)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isUnread ? "hsl(213 100% 98%)" : "transparent";
                  }}
                >
                  {/* Accent bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
                    style={{ background: isUnread ? accent : "transparent" }}
                  />

                  {/* Dot */}
                  <div className="flex-shrink-0 mt-1">
                    {isUnread
                      ? <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                      : <div className="w-2 h-2 rounded-full" style={{ background: "hsl(218 23% 88%)" }} />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p
                      className="text-sm leading-snug"
                      style={{ color: isUnread ? "#323338" : "#676879", fontWeight: isUnread ? 600 : 400 }}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#676879" }}>
                        {n.body}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "hsl(218 23% 70%)" }}>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>

                  {/* Dismiss button — shown on hover */}
                  <button
                    onClick={(e) => dismiss(n.id, e)}
                    className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                    style={{ color: "#676879" }}
                    onMouseEnter={(e2) => { (e2.currentTarget as HTMLElement).style.background = "hsl(218 23% 91%)"; }}
                    onMouseLeave={(e2) => { (e2.currentTarget as HTMLElement).style.background = ""; }}
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div
              className="px-4 py-2.5 text-center"
              style={{ borderTop: "1px solid hsl(218 23% 91%)" }}
            >
              <button
                onClick={() => { setOpen(false); router.push("/notifications"); }}
                className="text-xs font-medium transition-colors"
                style={{ color: "#0073ea" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#0060c0"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#0073ea"; }}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
