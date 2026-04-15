"use client";

import { Bell, Search, ChevronDown, LogOut, KeyRound, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { post, patch } from "@/lib/api-client";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic avatar color from name — same Monday-style palette
const AVATAR_COLORS = [
  "#0073ea", "#a25ddc", "#00ca72", "#fdab3d",
  "#e2445c", "#579bfc", "#ff7575", "#66ccff",
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await patch("/auth/change-password", { currentPassword, newPassword });
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,26,67,0.4)" }}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6"
        style={{ boxShadow: "0 16px 48px rgba(26,26,67,0.24)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "#323338" }}>Change Password</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ color: "#676879" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 94%)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-medium">✓ Password changed successfully</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "hsl(218 23% 88%)" }}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "hsl(218 23% 88%)" }}
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "hsl(218 23% 88%)" }}
                placeholder="Repeat new password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: "hsl(218 23% 88%)", color: "#676879" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 97%)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-9 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "#0073ea" }}
                onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.background = "#0060c0"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#0073ea"; }}
              >
                {saving ? "Saving…" : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const initials    = user ? getInitials(user.name) : "?";
  const displayName = user?.name ?? "Loading…";
  const roleName    = user?.role.displayName ?? "";
  const avatarColor = user ? getAvatarColor(user.name) : "#0073ea";

  async function handleLogout() {
    setLoggingOut(true);
    try { await post("/auth/logout", {}); } catch { /* ignore */ }
    finally {
      // Clear all cached queries so the next login shows fresh user data
      queryClient.clear();
      router.push("/login");
    }
  }

  return (
    <>
    <header
      className="h-[56px] flex items-center justify-between px-5 flex-shrink-0 bg-card"
      style={{ boxShadow: "0 1px 0 hsl(218 23% 91%)" }}
    >
      {/* Global search — Monday style pill */}
      <button
        className="flex items-center gap-2 px-3 h-8 rounded-full border text-sm transition-all duration-150"
        style={{
          background: "hsl(228 33% 97%)",
          borderColor: "hsl(218 23% 88%)",
          color: "hsl(237 7% 47%)",
          minWidth: "240px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "#0073ea";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "hsl(218 23% 88%)";
        }}
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#676879" }} />
        <span style={{ color: "#676879" }}>Search…</span>
        <kbd
          className="ml-auto text-xs font-mono rounded px-1.5 py-0.5"
          style={{ background: "hsl(218 23% 91%)", color: "#676879", fontSize: "10px" }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications bell */}
        <button
          className="relative w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: "#676879" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 94%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
          }}
        >
          <Bell className="w-4 h-4" />
          {/* Notification dot */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
            style={{ background: "#e2445c" }}
          />
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-1" style={{ background: "hsl(218 23% 91%)" }} />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 h-8 rounded-full transition-colors"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 94%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "";
            }}
          >
            {/* Avatar circle */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <p className="text-sm font-medium" style={{ color: "#323338" }}>{displayName}</p>
              {roleName && (
                <p className="text-xs" style={{ color: "#676879" }}>{roleName}</p>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 ml-0.5" style={{ color: "#676879" }} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl z-20 overflow-hidden"
                style={{ boxShadow: "0 8px 24px rgba(26,26,67,0.16)", border: "1px solid hsl(218 23% 91%)", background: "#fff" }}
              >
                {/* User info header */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(218 23% 91%)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: avatarColor }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#323338" }}>{displayName}</p>
                      <p className="text-xs truncate" style={{ color: "#676879" }}>{user?.email}</p>
                    </div>
                  </div>
                  <div
                    className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: "hsl(213 100% 95%)", color: "#0073ea" }}
                  >
                    {roleName}
                  </div>
                </div>

                {/* Change Password */}
                <button
                  onClick={() => { setMenuOpen(false); setShowChangePassword(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: "#323338" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 97%)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  <KeyRound className="w-4 h-4" style={{ color: "#676879" }} />
                  Change Password
                </button>

                {/* Divider */}
                <div style={{ height: "1px", background: "hsl(218 23% 91%)" }} />

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
                  style={{ color: "#e2445c" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#fff5f7";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {showChangePassword && (
      <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
    )}
    </>
  );
}
