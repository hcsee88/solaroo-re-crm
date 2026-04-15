"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { get } from "@/lib/api-client";
import {
  Search, Plus, UserCheck, UserX, Shield, ChevronLeft, ChevronRight,
} from "lucide-react";

type Role = { id: string; name: string; displayName: string; _count: { users: number } };

type UserItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  role: { id: string; name: string; displayName: string };
};

type PageData = {
  items: UserItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export default function UsersPage() {
  const [users, setUsers]     = useState<PageData | null>(null);
  const [roles, setRoles]     = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [roleId, setRoleId]   = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [page, setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search)   params.set("search", search);
      if (roleId)   params.set("roleId", roleId);
      if (isActive) params.set("isActive", isActive);
      const data = await get<PageData>(`/admin/users?${params}`);
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [search, roleId, isActive, page]);

  useEffect(() => {
    get<Role[]>("/admin/roles").then(setRoles).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [search, roleId, isActive]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users ? `${users.total} user${users.total !== 1 ? "s" : ""}` : "—"}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New User
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.displayName}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={isActive}
          onChange={(e) => setIsActive(e.target.value as "" | "true" | "false")}
        >
          <option value="">Active &amp; inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              users?.items.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOURS[user.role.name] ?? "bg-gray-100 text-gray-800"}`}>
                      <Shield className="w-3 h-3" />
                      {user.role.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                        <UserX className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("en-MY", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {users && users.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(users.page - 1) * users.pageSize + 1}–
            {Math.min(users.page * users.pageSize, users.total)} of {users.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded border hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded border bg-muted font-medium text-foreground">
              {page} / {users.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(users.totalPages, p + 1))}
              disabled={page === users.totalPages}
              className="p-1.5 rounded border hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
