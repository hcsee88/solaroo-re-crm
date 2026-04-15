"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { get, patch, post } from "@/lib/api-client";
import {
  ArrowLeft, Shield, UserCheck, UserX, KeyRound, Eye, EyeOff, Save,
} from "lucide-react";

type Role = { id: string; name: string; displayName: string };
type UserDetail = {
  id: string; name: string; email: string; avatarUrl: string | null;
  isActive: boolean; createdAt: string; updatedAt: string;
  role: { id: string; name: string; displayName: string };
};

const ROLE_COLOURS: Record<string, string> = {
  DIRECTOR:               "bg-purple-100 text-purple-800",
  SALES_MANAGER:          "bg-blue-100 text-blue-800",
  SALES_ENGINEER:         "bg-sky-100 text-sky-800",
  PROJECT_MANAGER:        "bg-green-100 text-green-800",
  DESIGN_ENGINEER:        "bg-teal-100 text-teal-800",
  PROCUREMENT:            "bg-orange-100 text-orange-800",
  SITE_SUPERVISOR:        "bg-yellow-100 text-yellow-800",
  COMMISSIONING_ENGINEER: "bg-pink-100 text-pink-800",
  OM_ENGINEER:            "bg-red-100 text-red-800",
  FINANCE_ADMIN:          "bg-indigo-100 text-indigo-800",
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser]         = useState<UserDetail | null>(null);
  const [roles, setRoles]       = useState<Role[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [editForm, setEditForm] = useState({ name: "", email: "", roleId: "", isActive: true });
  const [passForm, setPassForm] = useState({ newPassword: "" });
  const [tab, setTab]           = useState<"details" | "password">("details");

  useEffect(() => {
    Promise.all([
      get<UserDetail>(`/admin/users/${id}`),
      get<Role[]>("/admin/roles"),
    ]).then(([u, r]) => {
      setUser(u);
      setRoles(r);
      setEditForm({ name: u.name, email: u.email, roleId: u.role.id, isActive: u.isActive });
    }).catch(() => {
      toast.error("Failed to load user");
      router.push("/admin/users");
    }).finally(() => setLoading(false));
  }, [id, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await patch<UserDetail>(`/admin/users/${id}`, editForm);
      setUser(updated);
      setEditForm({ name: updated.name, email: updated.email, roleId: updated.role.id, isActive: updated.isActive });
      toast.success("User updated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (passForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    try {
      await post(`/admin/users/${id}/reset-password`, passForm);
      toast.success("Password reset successfully");
      setPassForm({ newPassword: "" });
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 bg-muted rounded animate-pulse w-48" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{user.name}</h1>
              {user.isActive ? (
                <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                  <UserCheck className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                  <UserX className="w-3.5 h-3.5" /> Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLOURS[user.role.name] ?? "bg-gray-100 text-gray-800"}`}>
          <Shield className="w-3 h-3" />
          {user.role.displayName}
        </span>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground flex gap-4">
        <span>Created {new Date(user.createdAt).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}</span>
        <span>Updated {new Date(user.updatedAt).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["details", "password"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "password" ? "Reset Password" : "Details"}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && (
        <form onSubmit={handleSave} className="space-y-5 bg-card border rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Full Name</label>
              <input
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Email Address</label>
              <input
                type="email"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Role</label>
              <select
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={editForm.roleId}
                onChange={(e) => setEditForm((f) => ({ ...f, roleId: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${editForm.isActive ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.isActive ? "translate-x-4" : "translate-x-1"}`} />
            </button>
            <label className="text-sm font-medium">Active account</label>
            <span className="text-xs text-muted-foreground">
              {editForm.isActive ? "User can log in" : "User cannot log in"}
            </span>
          </div>

          <div className="flex gap-3 pt-2 border-t">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Reset password tab */}
      {tab === "password" && (
        <form onSubmit={handleResetPassword} className="space-y-5 bg-card border rounded-xl p-6">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Setting a new password will immediately replace the user&apos;s current password.
            The user will need to use the new password on their next login.
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Min. 8 characters"
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ newPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t">
            <button
              type="submit"
              disabled={resetting || !passForm.newPassword}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              {resetting ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
