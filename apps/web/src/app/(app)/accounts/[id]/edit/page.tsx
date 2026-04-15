"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { get, patch } from "@/lib/api-client";
import type { AccountDetail, AccountType } from "@solaroo/types";
import { ACCOUNT_TYPE_LABELS } from "@solaroo/types";

const ACCOUNT_TYPES: AccountType[] = [
  "CLIENT", "PROSPECT", "PARTNER", "CONSULTANT", "VENDOR",
];

const MALAYSIA_REGIONS = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
  "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya",
];

type FormState = {
  name: string;
  type: AccountType;
  industry: string;
  registrationNo: string;
  country: string;
  region: string;
  website: string;
  notes: string;
  isActive: boolean;
};

export default function EditAccountPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState>({
    name: "", type: "PROSPECT", industry: "", registrationNo: "",
    country: "Malaysia", region: "", website: "", notes: "", isActive: true,
  });
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    get<AccountDetail>(`/accounts/${id}`)
      .then((a) => {
        setAccount(a);
        setForm({
          name: a.name,
          type: a.type,
          industry: a.industry ?? "",
          registrationNo: a.registrationNo ?? "",
          country: a.country ?? "Malaysia",
          region: a.region ?? "",
          website: a.website ?? "",
          notes: a.notes ?? "",
          isActive: a.isActive,
        });
      })
      .catch((err) => setServerError(err instanceof Error ? err.message : "Failed to load account"))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (typeof value === "string") {
      setErrors((prev) => { const next = { ...prev }; delete next[field as string]; return next; });
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      errs.website = "Must start with http:// or https://";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await patch(`/accounts/${id}`, {
        name: form.name.trim(),
        type: form.type,
        industry: form.industry.trim() || undefined,
        registrationNo: form.registrationNo.trim() || undefined,
        country: form.country || "Malaysia",
        region: form.region || undefined,
        website: form.website.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
      router.push(`/accounts/${id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${
      errors[field] ? "border-destructive" : "border-input"
    }`;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="rounded-lg border bg-card p-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!account && serverError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {serverError}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/accounts" className="hover:text-foreground">Accounts</Link>
        <span>/</span>
        <Link href={`/accounts/${id}`} className="hover:text-foreground">{account?.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Edit Account</h1>
        <p className="text-sm text-muted-foreground">Update details for {account?.name}</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass("name")}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Type <span className="text-destructive">*</span></label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                placeholder="e.g. Plantation, Resort, C&I"
                className={inputClass("industry")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Registration No.</label>
              <input
                type="text"
                value={form.registrationNo}
                onChange={(e) => set("registrationNo", e.target.value)}
                placeholder="e.g. 202201012345"
                className={inputClass("registrationNo")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
                className={inputClass("website")}
              />
              {errors.website && <p className="mt-1 text-xs text-destructive">{errors.website}</p>}
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className={inputClass("country")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">State / Region</label>
              <select
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Select state —</option>
                {MALAYSIA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            placeholder="Any relevant context about this account…"
            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </section>

        {/* Status */}
        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="isActive" className="text-sm font-medium">Active account</label>
            <span className="text-xs text-muted-foreground">(Inactive accounts are hidden from dropdowns by default)</span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/accounts/${id}`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
