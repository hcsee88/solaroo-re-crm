"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { get, patch } from "@/lib/api-client";
import type { SiteDetail, SiteGridCategory, ContactListItem, PaginatedResult } from "@solaroo/types";
import { SITE_GRID_CATEGORY_LABELS } from "@solaroo/types";

const GRID_CATEGORIES: SiteGridCategory[] = ["OFF_GRID", "WEAK_GRID", "GRID_CONNECTED", "HYBRID"];

const MALAYSIA_REGIONS = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
  "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya",
];

type FormState = {
  name: string;
  gridCategory: SiteGridCategory;
  primaryContactId: string;
  address: string;
  latitude: string;
  longitude: string;
  country: string;
  region: string;
  operatingSchedule: string;
  accessConstraints: string;
  safetyConstraints: string;
  notes: string;
  isActive: boolean;
};

export default function EditSitePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState>({
    name: "", gridCategory: "OFF_GRID", primaryContactId: "",
    address: "", latitude: "", longitude: "",
    country: "Malaysia", region: "",
    operatingSchedule: "", accessConstraints: "", safetyConstraints: "",
    notes: "", isActive: true,
  });
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    get<SiteDetail>(`/sites/${id}`)
      .then((s) => {
        setSite(s);
        setForm({
          name: s.name,
          gridCategory: s.gridCategory,
          primaryContactId: s.primaryContactId ?? "",
          address: s.address ?? "",
          latitude: s.latitude ?? "",
          longitude: s.longitude ?? "",
          country: s.country,
          region: s.region ?? "",
          operatingSchedule: s.operatingSchedule ?? "",
          accessConstraints: s.accessConstraints ?? "",
          safetyConstraints: s.safetyConstraints ?? "",
          notes: s.notes ?? "",
          isActive: s.isActive,
        });
        // Load contacts for this account
        return get<PaginatedResult<ContactListItem>>(
          `/contacts?accountId=${s.accountId}&pageSize=200&isActive=true&sortBy=lastName&sortDir=asc`
        );
      })
      .then((c) => setContacts(c.items))
      .catch((err) => setServerError(err instanceof Error ? err.message : "Failed to load site"))
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
    if (!form.name.trim()) errs.name = "Site name is required";
    if (form.latitude && (isNaN(Number(form.latitude)) || Math.abs(Number(form.latitude)) > 90)) {
      errs.latitude = "Latitude must be -90 to 90";
    }
    if (form.longitude && (isNaN(Number(form.longitude)) || Math.abs(Number(form.longitude)) > 180)) {
      errs.longitude = "Longitude must be -180 to 180";
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
      await patch(`/sites/${id}`, {
        name: form.name.trim(),
        gridCategory: form.gridCategory,
        primaryContactId: form.primaryContactId || undefined,
        address: form.address.trim() || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        country: form.country || "Malaysia",
        region: form.region || undefined,
        operatingSchedule: form.operatingSchedule.trim() || undefined,
        accessConstraints: form.accessConstraints.trim() || undefined,
        safetyConstraints: form.safetyConstraints.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      });
      router.push(`/sites/${id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update site");
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
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 rounded bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!site && serverError) {
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
        <Link href="/sites" className="hover:text-foreground">Sites</Link>
        <span>/</span>
        <Link href={`/sites/${id}`} className="hover:text-foreground">{site?.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Edit Site</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{site?.siteCode}</span>
          {site && (
            <>
              {" · "}
              <Link href={`/accounts/${site.account.id}`} className="hover:text-primary hover:underline">
                {site.account.name}
              </Link>
            </>
          )}
        </p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Site details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Site Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass("name")}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Grid Category <span className="text-destructive">*</span></label>
              <select
                value={form.gridCategory}
                onChange={(e) => set("gridCategory", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {GRID_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SITE_GRID_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Operating Schedule</label>
              <input
                type="text"
                value={form.operatingSchedule}
                onChange={(e) => set("operatingSchedule", e.target.value)}
                placeholder="e.g. 24/7, 6am–6pm Mon–Sat"
                className={inputClass("operatingSchedule")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Primary Contact</label>
              <select
                value={form.primaryContactId}
                onChange={(e) => set("primaryContactId", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— None —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.jobTitle ? ` · ${c.jobTitle}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street address, area…"
                className={inputClass("address")}
              />
            </div>
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
            <div>
              <label className="block text-sm font-medium mb-1.5">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={(e) => set("latitude", e.target.value)}
                placeholder="e.g. 3.1390"
                className={inputClass("latitude")}
              />
              {errors.latitude && <p className="mt-1 text-xs text-destructive">{errors.latitude}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={(e) => set("longitude", e.target.value)}
                placeholder="e.g. 101.6869"
                className={inputClass("longitude")}
              />
              {errors.longitude && <p className="mt-1 text-xs text-destructive">{errors.longitude}</p>}
            </div>
          </div>
        </section>

        {/* Constraints */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Constraints</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Access Constraints</label>
            <textarea
              value={form.accessConstraints}
              onChange={(e) => set("accessConstraints", e.target.value)}
              rows={2}
              placeholder="Gate codes, restricted hours, permit requirements…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Safety Constraints</label>
            <textarea
              value={form.safetyConstraints}
              onChange={(e) => set("safetyConstraints", e.target.value)}
              rows={2}
              placeholder="PPE requirements, hazardous areas, emergency procedures…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="Any relevant context about this site…"
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
            <label htmlFor="isActive" className="text-sm font-medium">Active site</label>
            <span className="text-xs text-muted-foreground">(Inactive sites are hidden from dropdowns by default)</span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/sites/${id}`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
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
