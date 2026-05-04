"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { get, patch } from "@/lib/api-client";
import type {
  OpportunityDetail,
  AccountListItem,
  SiteListItem,
  PaginatedResult,
} from "@solaroo/types";
import { COMMERCIAL_MODEL_LABELS } from "@solaroo/types";

const COMMERCIAL_MODELS = [
  "CAPEX_SALE", "LEASE", "PPA", "HYBRID_CAPEX_PPA", "EPC_ONLY", "DESIGN_AND_SUPPLY",
] as const;

type UserOption = { id: string; name: string; email: string; roleName: string };

const DESIGN_ROLES = new Set(["DESIGN_ENGINEER", "DESIGN_LEAD"]);

type FormState = {
  title: string;
  ownerUserId: string;
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
  nextAction: string;
  nextActionDueDate: string;
  lastStatusNote: string;
};

export default function EditOpportunityPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState>({
    title: "", ownerUserId: "", designEngineerId: "", commercialModel: "",
    estimatedValue: "", estimatedPvKwp: "", estimatedBessKw: "", estimatedBessKwh: "",
    probabilityPercent: "", expectedAwardDate: "", summary: "", risks: "", competitors: "",
    nextAction: "", nextActionDueDate: "", lastStatusNote: "",
  });
  const [opp, setOpp] = useState<OpportunityDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      get<OpportunityDetail>(`/opportunities/${id}`),
      get<UserOption[]>("/admin/users/dropdown"),
    ])
      .then(([o, u]) => {
        setOpp(o);
        setUsers(u);
        setForm({
          title: o.title,
          ownerUserId: o.ownerUserId,
          designEngineerId: o.designEngineerId ?? "",
          commercialModel: o.commercialModel ?? "",
          estimatedValue: o.estimatedValue ?? "",
          estimatedPvKwp: o.estimatedPvKwp ?? "",
          estimatedBessKw: o.estimatedBessKw ?? "",
          estimatedBessKwh: o.estimatedBessKwh ?? "",
          probabilityPercent: o.probabilityPercent != null ? String(o.probabilityPercent) : "",
          expectedAwardDate: o.expectedAwardDate
            ? (new Date(o.expectedAwardDate).toISOString().split("T")[0] ?? "")
            : "",
          summary: o.summary ?? "",
          risks: o.risks ?? "",
          competitors: o.competitors ?? "",
          nextAction: o.nextAction ?? "",
          nextActionDueDate: o.nextActionDueDate ? o.nextActionDueDate.slice(0, 10) : "",
          lastStatusNote: o.lastStatusNote ?? "",
        });
      })
      .catch((err) => setServerError(err instanceof Error ? err.message : "Failed to load opportunity"))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.ownerUserId) errs.ownerUserId = "Owner is required";
    if (form.probabilityPercent) {
      const p = parseInt(form.probabilityPercent);
      if (isNaN(p) || p < 0 || p > 100) errs.probabilityPercent = "Must be 0–100";
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
      await patch(`/opportunities/${id}`, {
        title: form.title.trim(),
        ownerUserId: form.ownerUserId,
        designEngineerId: form.designEngineerId || null,
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
        nextAction: form.nextAction.trim() || null,
        nextActionDueDate: form.nextActionDueDate ? new Date(form.nextActionDueDate).toISOString() : null,
        lastStatusNote: form.lastStatusNote.trim() || null,
      });
      router.push(`/opportunities/${id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update opportunity");
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

  if (!opp && serverError) {
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
        <Link href="/opportunities" className="hover:text-foreground">Opportunities</Link>
        <span>/</span>
        <Link href={`/opportunities/${id}`} className="hover:text-foreground truncate max-w-[200px]">{opp?.title}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Edit Opportunity</h1>
        <p className="text-sm text-muted-foreground font-mono">{opp?.opportunityCode}</p>
      </div>

      {/* Read-only context */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Account: </span>
        <Link href={`/accounts/${opp?.account.id}`} className="font-medium hover:text-primary hover:underline">
          {opp?.account.name}
        </Link>
        <span className="mx-3 text-border">|</span>
        <span className="text-muted-foreground">Site: </span>
        <Link href={`/sites/${opp?.site.id}`} className="font-medium hover:text-primary hover:underline">
          {opp?.site.name}
        </Link>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Core Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Title <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputClass("title")}
              />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Owner <span className="text-destructive">*</span></label>
              <select
                value={form.ownerUserId}
                onChange={(e) => set("ownerUserId", e.target.value)}
                className={`w-full h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors.ownerUserId ? "border-destructive" : "border-input"}`}
              >
                <option value="">— Select owner —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {errors.ownerUserId && <p className="mt-1 text-xs text-destructive">{errors.ownerUserId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Design Engineer</label>
              <select
                value={form.designEngineerId}
                onChange={(e) => set("designEngineerId", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Unassigned —</option>
                {users
                  .filter((u) => DESIGN_ROLES.has(u.roleName))
                  .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Commercial Model</label>
              <select
                value={form.commercialModel}
                onChange={(e) => set("commercialModel", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Not set —</option>
                {COMMERCIAL_MODELS.map((m) => (
                  <option key={m} value={m}>{COMMERCIAL_MODEL_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.probabilityPercent}
                onChange={(e) => set("probabilityPercent", e.target.value)}
                placeholder="0–100"
                className={inputClass("probabilityPercent")}
              />
              {errors.probabilityPercent && <p className="mt-1 text-xs text-destructive">{errors.probabilityPercent}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected Award Date</label>
              <input
                type="date"
                value={form.expectedAwardDate}
                onChange={(e) => set("expectedAwardDate", e.target.value)}
                className={inputClass("expectedAwardDate")}
              />
            </div>
          </div>
        </section>

        {/* Commercial */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commercial</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Estimated Value (MYR)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={form.estimatedValue}
              onChange={(e) => set("estimatedValue", e.target.value)}
              placeholder="e.g. 850000"
              className={inputClass("estimatedValue")}
            />
          </div>
        </section>

        {/* Technical scope */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Technical Scope</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Solar PV (kWp)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.estimatedPvKwp}
                onChange={(e) => set("estimatedPvKwp", e.target.value)}
                placeholder="e.g. 250"
                className={inputClass("estimatedPvKwp")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">BESS Power (kW)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.estimatedBessKw}
                onChange={(e) => set("estimatedBessKw", e.target.value)}
                placeholder="e.g. 100"
                className={inputClass("estimatedBessKw")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">BESS Energy (kWh)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.estimatedBessKwh}
                onChange={(e) => set("estimatedBessKwh", e.target.value)}
                placeholder="e.g. 200"
                className={inputClass("estimatedBessKwh")}
              />
            </div>
          </div>
        </section>

        {/* Narrative */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Narrative</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={3}
              placeholder="Brief description of this opportunity…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Key Risks</label>
            <textarea
              value={form.risks}
              onChange={(e) => set("risks", e.target.value)}
              rows={2}
              placeholder="Site risks, technical concerns, commercial risks…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Competitors</label>
            <textarea
              value={form.competitors}
              onChange={(e) => set("competitors", e.target.value)}
              rows={2}
              placeholder="Known competitors bidding on this…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
        </section>

        {/* Next Action / Status */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next Action &amp; Status</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Next Action</label>
            <input
              type="text"
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
              placeholder="e.g. Send revised proposal to client"
              maxLength={500}
              className={inputClass("nextAction")}
            />
            <p className="mt-1 text-xs text-muted-foreground">What needs to happen next to advance this opportunity.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Next Action Due Date</label>
            <input
              type="date"
              value={form.nextActionDueDate}
              onChange={(e) => set("nextActionDueDate", e.target.value)}
              className={inputClass("nextActionDueDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Latest Status Note</label>
            <textarea
              value={form.lastStatusNote}
              onChange={(e) => set("lastStatusNote", e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Brief status update visible on the management dashboard…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/opportunities/${id}`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
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
