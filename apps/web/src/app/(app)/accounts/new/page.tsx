"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { post } from "@/lib/api-client";
import type { AccountType, AccountDetail } from "@solaroo/types";
import { ACCOUNT_TYPE_LABELS } from "@solaroo/types";

const ACCOUNT_TYPES: AccountType[] = [
  "CLIENT",
  "PROSPECT",
  "PARTNER",
  "CONSULTANT",
  "VENDOR",
];

const MALAYSIA_REGIONS = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
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
};

const INITIAL: FormState = {
  name: "",
  type: "PROSPECT",
  industry: "",
  registrationNo: "",
  country: "Malaysia",
  region: "",
  website: "",
  notes: "",
};

export default function NewAccountPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.type) errs.type = "Type is required";
    if (
      form.website &&
      !/^https?:\/\/.+/.test(form.website)
    ) {
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
      const account = await post<AccountDetail>("/accounts", {
        name: form.name.trim(),
        type: form.type,
        industry: form.industry.trim() || undefined,
        registrationNo: form.registrationNo.trim() || undefined,
        country: form.country || "Malaysia",
        region: form.region || undefined,
        website: form.website.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      router.push(`/accounts/${account.id}`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create account"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Accounts
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Account</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">New Account</h1>
        <p className="text-sm text-muted-foreground">
          Add a client, prospect, partner or consultant
        </p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Basic Details
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">
                Company Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Green Palm Estate Sdn Bhd"
                className={`w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${
                  errors.name ? "border-destructive" : "border-input"
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Account Type <span className="text-destructive">*</span>
              </label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Industry
              </label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                placeholder="e.g. Plantation, Resort, C&I"
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Registration No.
              </label>
              <input
                type="text"
                value={form.registrationNo}
                onChange={(e) => set("registrationNo", e.target.value)}
                placeholder="e.g. 202201012345"
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Website
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
                className={`w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${
                  errors.website ? "border-destructive" : "border-input"
                }`}
              />
              {errors.website && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.website}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Location
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Country
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                State / Region
              </label>
              <select
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Select state —</option>
                {MALAYSIA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            placeholder="Any relevant context about this account…"
            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/accounts"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
