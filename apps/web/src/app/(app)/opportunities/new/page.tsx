"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get, post } from "@/lib/api-client";
import type {
  OpportunityDetail,
  AccountListItem,
  SiteListItem,
  PaginatedResult,
} from "@solaroo/types";
import { COMMERCIAL_MODEL_LABELS } from "@solaroo/types";

const COMMERCIAL_MODELS = Object.keys(COMMERCIAL_MODEL_LABELS);

type FormState = {
  title: string;
  accountId: string;
  siteId: string;
  designEngineerId: string;
  commercialModel: string;
  estimatedValue: string;
  estimatedPvKwp: string;
  estimatedBessKw: string;
  estimatedBessKwh: string;
  probabilityPercent: string;
  expectedAwardDate: string;
  summary: string;
  risks: string;
  competitors: string;
};

const INITIAL: FormState = {
  title: "",
  accountId: "",
  siteId: "",
  designEngineerId: "",
  commercialModel: "",
  estimatedValue: "",
  estimatedPvKwp: "",
  estimatedBessKw: "",
  estimatedBessKwh: "",
  probabilityPercent: "20",
  expectedAwardDate: "",
  summary: "",
  risks: "",
  competitors: "",
};

// Roles eligible to be tagged as the Design Engineer on an opportunity
const DESIGN_ROLES = new Set(["DESIGN_ENGINEER", "DESIGN_LEAD"]);

function NewOpportunityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledAccountId = searchParams.get("accountId") ?? "";

  const [form, setForm] = useState<FormState>({ ...INITIAL, accountId: prefilledAccountId });
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [designUsers, setDesignUsers] = useState<{ id: string; name: string; roleName: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Load user info for ownerUserId — use current session
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    get<PaginatedResult<AccountListItem>>("/accounts?pageSize=200&isActive=true&sortBy=name&sortDir=asc")
      .then((r) => setAccounts(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.accountId) { setSites([]); return; }
    get<PaginatedResult<SiteListItem>>(`/sites?accountId=${form.accountId}&pageSize=100&isActive=true`)
      .then((r) => setSites(r.items))
      .catch(() => {});
  }, [form.accountId]);

  // Get current user ID from the auth endpoint
  useEffect(() => {
    get<{ id: string }>("/auth/me")
      .then((u) => setCurrentUserId(u.id))
      .catch(() => {});
  }, []);

  // Load user dropdown filtered to design roles
  useEffect(() => {
    get<{ id: string; name: string; roleName: string }[]>("/admin/users/dropdown")
      .then((rows) => setDesignUsers(rows.filter((u) => DESIGN_ROLES.has(u.roleName))))
      .catch(() => {});
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "accountId") next.siteId = ""; // reset site when account changes
      return next;
    });
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.accountId) errs.accountId = "Account is required";
    if (!form.siteId) errs.siteId = "Site is required";
    if (!currentUserId) errs.owner = "Could not determine current user";
    if (form.probabilityPercent && (isNaN(+form.probabilityPercent) || +form.probabilityPercent < 0 || +form.probabilityPercent > 100)) {
      errs.probabilityPercent = "Must be 0–100";
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
      const opp = await post<OpportunityDetail>("/opportunities", {
        title: form.title.trim(),
        accountId: form.accountId,
        siteId: form.siteId,
        ownerUserId: currentUserId,
        designEngineerId: form.designEngineerId || undefined,
        commercialModel: form.commercialModel || undefined,
        estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
        estimatedPvKwp: form.estimatedPvKwp ? parseFloat(form.estimatedPvKwp) : undefined,
        estimatedBessKw: form.estimatedBessKw ? parseFloat(form.estimatedBessKw) : undefined,
        estimatedBessKwh: form.estimatedBessKwh ? parseFloat(form.estimatedBessKwh) : undefined,
        probabilityPercent: form.probabilityPercent ? parseInt(form.probabilityPercent) : undefined,
        expectedAwardDate: form.expectedAwardDate ? new Date(form.expectedAwardDate).toISOString() : undefined,
        summary: form.summary.trim() || undefined,
        risks: form.risks.trim() || undefined,
        competitors: form.competitors.trim() || undefined,
      });
      router.push(`/opportunities/${opp.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create opportunity");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (f: string) =>
    `w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors[f] ? "border-destructive" : "border-input"}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/opportunities" className="hover:text-foreground">← Opportunities</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Opportunity</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">New Opportunity</h1>
        <p className="text-sm text-muted-foreground">Creates at LEAD stage — advance the stage once details are confirmed</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      {errors.owner && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors.owner}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Opportunity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Title <span className="text-destructive">*</span></label>
              <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. 500kWp Off-Grid Solar + BESS for Green Palm Estate"
                className={inputClass("title")} />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account <span className="text-destructive">*</span></label>
              <select value={form.accountId} onChange={(e) => set("accountId", e.target.value)}
                className={`${inputClass("accountId")} bg-background`}>
                <option value="">— Select account —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {errors.accountId && <p className="mt-1 text-xs text-destructive">{errors.accountId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Site <span className="text-destructive">*</span></label>
              <select value={form.siteId} onChange={(e) => set("siteId", e.target.value)}
                disabled={!form.accountId}
                className={`${inputClass("siteId")} bg-background disabled:opacity-50`}>
                <option value="">{form.accountId ? "— Select site —" : "— Select account first —"}</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.siteCode})</option>)}
              </select>
              {errors.siteId && <p className="mt-1 text-xs text-destructive">{errors.siteId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Commercial Model</label>
              <select value={form.commercialModel} onChange={(e) => set("commercialModel", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Select model —</option>
                {COMMERCIAL_MODELS.map((m) => <option key={m} value={m}>{COMMERCIAL_MODEL_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Design Engineer</label>
              <select value={form.designEngineerId} onChange={(e) => set("designEngineerId", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Unassigned —</option>
                {designUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Probability (%)</label>
              <input type="number" min={0} max={100} value={form.probabilityPercent}
                onChange={(e) => set("probabilityPercent", e.target.value)}
                className={inputClass("probabilityPercent")} />
              {errors.probabilityPercent && <p className="mt-1 text-xs text-destructive">{errors.probabilityPercent}</p>}
            </div>
          </div>
        </section>

        {/* Commercial */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commercial & Technical</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated Value (MYR)</label>
              <input type="number" min={0} step="1000" value={form.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                placeholder="e.g. 2500000"
                className={inputClass("estimatedValue")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Award Date</label>
              <input type="date" value={form.expectedAwardDate}
                onChange={(e) => set("expectedAwardDate", e.target.value)}
                className={inputClass("expectedAwardDate")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Solar PV (kWp)</label>
              <input type="number" min={0} step="0.1" value={form.estimatedPvKwp}
                onChange={(e) => set("estimatedPvKwp", e.target.value)}
                placeholder="e.g. 500" className={inputClass("estimatedPvKwp")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">BESS (kW)</label>
              <input type="number" min={0} step="0.1" value={form.estimatedBessKw}
                onChange={(e) => set("estimatedBessKw", e.target.value)}
                placeholder="e.g. 250" className={inputClass("estimatedBessKw")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">BESS (kWh)</label>
              <input type="number" min={0} step="0.1" value={form.estimatedBessKwh}
                onChange={(e) => set("estimatedBessKwh", e.target.value)}
                placeholder="e.g. 500" className={inputClass("estimatedBessKwh")} />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Context</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Summary</label>
              <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={3}
                placeholder="Brief description of the opportunity and customer need…"
                className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Key Risks</label>
                <textarea value={form.risks} onChange={(e) => set("risks", e.target.value)} rows={2}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Competitors</label>
                <textarea value={form.competitors} onChange={(e) => set("competitors", e.target.value)} rows={2}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link href="/opportunities" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</Link>
          <button type="submit" disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
            {submitting ? "Creating…" : "Create Opportunity"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewOpportunityPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-8 w-48 rounded bg-muted" />}>
      <NewOpportunityPageContent />
    </Suspense>
  );
}
