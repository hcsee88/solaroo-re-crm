"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get, post } from "@/lib/api-client";
import type { SiteDetail, SiteGridCategory, AccountListItem, ContactListItem, PaginatedResult } from "@solaroo/types";
import { SITE_GRID_CATEGORY_LABELS } from "@solaroo/types";

const GRID_CATEGORIES: SiteGridCategory[] = ["OFF_GRID", "WEAK_GRID", "GRID_CONNECTED", "HYBRID"];

const MALAYSIA_REGIONS = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
  "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya",
];

type FormState = {
  name: string;
  accountId: string;
  primaryContactId: string;
  gridCategory: SiteGridCategory;
  address: string;
  latitude: string;
  longitude: string;
  country: string;
  region: string;
  operatingSchedule: string;
  accessConstraints: string;
  safetyConstraints: string;
  notes: string;
};

const INITIAL: FormState = {
  name: "",
  accountId: "",
  primaryContactId: "",
  gridCategory: "OFF_GRID",
  address: "",
  latitude: "",
  longitude: "",
  country: "Malaysia",
  region: "",
  operatingSchedule: "",
  accessConstraints: "",
  safetyConstraints: "",
  notes: "",
};

function NewSitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledAccountId = searchParams.get("accountId") ?? "";

  const [form, setForm] = useState<FormState>({ ...INITIAL, accountId: prefilledAccountId });
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    get<PaginatedResult<AccountListItem>>("/accounts?pageSize=200&isActive=true&sortBy=name&sortDir=asc")
      .then((r) => setAccounts(r.items))
      .catch(() => {});
  }, []);

  // When account changes, load contacts for that account
  useEffect(() => {
    if (!form.accountId) {
      setContacts([]);
      setForm((prev) => ({ ...prev, primaryContactId: "" }));
      return;
    }
    setLoadingContacts(true);
    get<PaginatedResult<ContactListItem>>(
      `/contacts?accountId=${form.accountId}&pageSize=200&sortBy=lastName&sortDir=asc`
    )
      .then((r) => setContacts(r.items))
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false));
  }, [form.accountId]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset contact when account changes
      if (field === "accountId") next.primaryContactId = "";
      return next;
    });
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Site name is required";
    if (!form.accountId) errs.accountId = "Account is required";
    if (!form.gridCategory) errs.gridCategory = "Grid type is required";
    if (form.latitude && isNaN(parseFloat(form.latitude))) errs.latitude = "Must be a number";
    if (form.longitude && isNaN(parseFloat(form.longitude))) errs.longitude = "Must be a number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const site = await post<SiteDetail>("/sites", {
        name: form.name.trim(),
        accountId: form.accountId,
        primaryContactId: form.primaryContactId || undefined,
        gridCategory: form.gridCategory,
        address: form.address.trim() || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        country: form.country || "Malaysia",
        region: form.region || undefined,
        operatingSchedule: form.operatingSchedule.trim() || undefined,
        accessConstraints: form.accessConstraints.trim() || undefined,
        safetyConstraints: form.safetyConstraints.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      if (prefilledAccountId) {
        router.push(`/accounts/${prefilledAccountId}`);
      } else {
        router.push(`/sites/${site.id}`);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setSubmitting(false);
    }
  }

  const backHref = prefilledAccountId ? `/accounts/${prefilledAccountId}` : "/sites";

  const inputClass = (field: string) =>
    `w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors[field] ? "border-destructive" : "border-input"}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={backHref} className="hover:text-foreground">← Back</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Site</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">New Site</h1>
        <p className="text-sm text-muted-foreground">Register a project or customer site</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Site Name <span className="text-destructive">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Green Palm Block A" className={inputClass("name")} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account <span className="text-destructive">*</span></label>
              <select value={form.accountId} onChange={(e) => set("accountId", e.target.value)}
                className={`${inputClass("accountId")} bg-background`}>
                <option value="">— Select account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.accountCode})</option>
                ))}
              </select>
              {errors.accountId && <p className="mt-1 text-xs text-destructive">{errors.accountId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Primary Contact</label>
              <select
                value={form.primaryContactId}
                onChange={(e) => set("primaryContactId", e.target.value)}
                disabled={!form.accountId || loadingContacts}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!form.accountId
                    ? "— Select account first —"
                    : loadingContacts
                    ? "Loading contacts…"
                    : contacts.length === 0
                    ? "— No contacts for this account —"
                    : "— Select contact (optional) —"}
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.jobTitle ? ` (${c.jobTitle})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                The main point of contact at this site.{" "}
                {form.accountId && contacts.length === 0 && !loadingContacts && (
                  <Link href={`/contacts/new?accountId=${form.accountId}`} className="text-primary hover:underline">
                    Add a contact first →
                  </Link>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Grid Category <span className="text-destructive">*</span></label>
              <select value={form.gridCategory} onChange={(e) => set("gridCategory", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {GRID_CATEGORIES.map((g) => (
                  <option key={g} value={g}>{SITE_GRID_CATEGORY_LABELS[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Operating Schedule</label>
              <input type="text" value={form.operatingSchedule} onChange={(e) => set("operatingSchedule", e.target.value)}
                placeholder="e.g. 24/7 or 06:00–22:00" className={inputClass("operatingSchedule")} />
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Address</label>
              <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
                rows={2} placeholder="Full site address"
                className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Country</label>
              <input type="text" value={form.country} onChange={(e) => set("country", e.target.value)}
                className={inputClass("country")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">State / Region</label>
              <select value={form.region} onChange={(e) => set("region", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Select state —</option>
                {MALAYSIA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)}
                placeholder="e.g. 5.4164" className={inputClass("latitude")} />
              {errors.latitude && <p className="mt-1 text-xs text-destructive">{errors.latitude}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)}
                placeholder="e.g. 117.8781" className={inputClass("longitude")} />
              {errors.longitude && <p className="mt-1 text-xs text-destructive">{errors.longitude}</p>}
            </div>
          </div>
        </section>

        {/* Constraints */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site Constraints</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Access Constraints</label>
              <textarea value={form.accessConstraints} onChange={(e) => set("accessConstraints", e.target.value)}
                rows={2} placeholder="e.g. Requires plantation permit, 4WD access only"
                className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Safety Constraints</label>
              <textarea value={form.safetyConstraints} onChange={(e) => set("safetyConstraints", e.target.value)}
                rows={2} placeholder="e.g. PPE required, working at height"
                className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                rows={3} className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link href={backHref} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</Link>
          <button type="submit" disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Creating…" : "Create Site"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewSitePage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-8 w-48 rounded bg-muted" />}>
      <NewSitePageContent />
    </Suspense>
  );
}
