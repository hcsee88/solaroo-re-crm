"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { get, post } from "@/lib/api-client";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type Role = { id: string; name: string; displayName: string };

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles]         = useState<Role[]>([]);
  const [saving, setSaving]       = useState(false);
  const [showPass, setShowPass]   = useState(false);

  const [form, setForm] = useState({
    name:     "",
    email:    "",
    password: "",
    roleId:   "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    get<Role[]>("/admin/roles").then(setRoles).catch(() => toast.error("Failed to load roles"));
  }, []);

  function set(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())    errs.name     = "Name is required";
    if (!form.email.trim())   errs.email    = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password)       errs.password = "Password is required";
    else if (form.password.length < 8) errs.password = "At least 8 characters";
    if (!form.roleId)         errs.roleId   = "Select a role";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const user = await post<{ id: string }>("/admin/users", form);
      toast.success("User created successfully");
      router.push(`/admin/users/${user.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      if (msg?.includes("already exists")) toast.error("A user with this email already exists");
      else toast.error("Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">New User</h1>
          <p className="text-sm text-muted-foreground">Create a new team member account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card border rounded-xl p-6">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></label>
          <input
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Ahmad Fauzi"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email Address <span className="text-destructive">*</span></label>
          <input
            type="email"
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="name@pekat.com.my"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Password <span className="text-destructive">*</span></label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              className="w-full px-3 py-2 pr-10 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Role <span className="text-destructive">*</span></label>
          <select
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.roleId}
            onChange={(e) => set("roleId", e.target.value)}
          >
            <option value="">Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.displayName}</option>
            ))}
          </select>
          {errors.roleId && <p className="text-xs text-destructive">{errors.roleId}</p>}
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => set("isActive", !form.isActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${form.isActive ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-1"}`} />
          </button>
          <label className="text-sm font-medium">Active account</label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create User"}
          </button>
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-md text-sm font-medium border hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
