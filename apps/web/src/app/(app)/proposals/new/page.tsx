"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get, post } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

type OpportunityOption = {
  id: string;
  opportunityCode: string;
  title: string;
  account: { id: string; name: string };
};

type ProposalDetail = { id: string };

type FormState = {
  opportunityId: string;
  title: string;
  estimatedCapex: string;
  marginPercent: string;
  estimatedSavings: string;
  paybackYears: string;
  technicalSummary: string;
  commercialSummary: string;
};

const INITIAL: FormState = {
  opportunityId: "",
  title: "",
  estimatedCapex: "",
  marginPercent: "",
  estimatedSavings: "",
  paybackYears: "",
  technicalSummary: "",
  commercialSummary: "",
};

function NewProposalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledOppId = searchParams.get("opportunityId") ?? "";

  const [form, setForm] = useState<FormState>({ ...INITIAL, opportunityId: prefilledOppId });
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    get<PaginatedResult<OpportunityOption>>(
      "/opportunities?pageSize=200&sortBy=updatedAt&sortDir=desc"
    )
      .then((r) => setOpportunities(r.items))
      .catch(() => {});
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.opportunityId) errs.opportunityId = "Opportunity is required";
    if (!form.title.trim()) errs.title = "Title is required";
    if (form.estimatedCapex && (isNaN(+form.estimatedCapex) || +form.estimatedCapex <= 0)) {
      errs.estimatedCapex = "Must be a positive number";
    }
    if (form.marginPercent && (isNaN(+form.marginPercent) || +form.marginPercent < 0 || +form.marginPercent > 100)) {
      errs.marginPercent = "Must be 0–100";
    }
    if (form.paybackYears && (isNaN(+form.paybackYears) || +form.paybackYears <= 0)) {
      errs.paybackYears = "Must be a positive number";
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
      const proposal = await post<ProposalDetail>("/proposals", {
        opportunityId:    form.opportunityId,
        title:            form.title.trim(),
        estimatedCapex:   form.estimatedCapex   ? parseFloat(form.estimatedCapex)   : undefined,
        marginPercent:    form.marginPercent     ? parseFloat(form.marginPercent)    : undefined,
        estimatedSavings: form.estimatedSavings  ? parseFloat(form.estimatedSavings) : undefined,
        paybackYears:     form.paybackYears      ? parseFloat(form.paybackYears)     : undefined,
        technicalSummary:  form.technicalSummary.trim()  || undefined,
        commercialSummary: form.commercialSummary.trim() || undefined,
      });
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (f: string) =>
    `w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${
      errors[f] ? "border-destructive" : "border-input"
    }`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/proposals" className="hover:text-foreground">← Proposals</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Proposal</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">New Proposal</h1>
        <p className="text-sm text-muted-foreground">Creates Version 1 as a draft — fill details and submit for approval when ready</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Link to opportunity */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Proposal</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Opportunity <span className="text-destructive">*</span></label>
            <select
              value={form.opportunityId}
              onChange={(e) => set("opportunityId", e.target.value)}
              className={`${inputClass("opportunityId")} bg-background`}
            >
              <option value="">— Select opportunity —</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.opportunityCode} — {o.title} ({o.account.name})
                </option>
              ))}
            </select>
            {errors.opportunityId && <p className="mt-1 text-xs text-destructive">{errors.opportunityId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Proposal Title <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Option A – CAPEX Sale, 500kWp Solar"
              className={inputClass("title")}
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>
        </section>

        {/* Commercial figures */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commercial Figures</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated CAPEX (MYR)</label>
              <input
                type="number"
                min={0}
                step="1000"
                value={form.estimatedCapex}
                onChange={(e) => set("estimatedCapex", e.target.value)}
                placeholder="e.g. 2500000"
                className={inputClass("estimatedCapex")}
              />
              {errors.estimatedCapex && <p className="mt-1 text-xs text-destructive">{errors.estimatedCapex}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Margin (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.marginPercent}
                onChange={(e) => set("marginPercent", e.target.value)}
                placeholder="e.g. 18"
                className={inputClass("marginPercent")}
              />
              {errors.marginPercent && <p className="mt-1 text-xs text-destructive">{errors.marginPercent}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated Annual Savings (MYR)</label>
              <input
                type="number"
                min={0}
                step="1000"
                value={form.estimatedSavings}
                onChange={(e) => set("estimatedSavings", e.target.value)}
                placeholder="e.g. 450000"
                className={inputClass("estimatedSavings")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Payback Period (years)</label>
              <input
                type="number"
                min={0}
                max={99}
                step="0.5"
                value={form.paybackYears}
                onChange={(e) => set("paybackYears", e.target.value)}
                placeholder="e.g. 5.5"
                className={inputClass("paybackYears")}
              />
              {errors.paybackYears && <p className="mt-1 text-xs text-destructive">{errors.paybackYears}</p>}
            </div>
          </div>
        </section>

        {/* Summaries */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Summaries (optional)</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Technical Summary</label>
            <textarea
              value={form.technicalSummary}
              onChange={(e) => set("technicalSummary", e.target.value)}
              rows={3}
              placeholder="Describe the proposed system design, equipment, and key technical points…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Commercial Summary</label>
            <textarea
              value={form.commercialSummary}
              onChange={(e) => set("commercialSummary", e.target.value)}
              rows={3}
              placeholder="Describe the commercial terms, payment structure, and key commercial points…"
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link href="/proposals" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Proposal"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-8 w-48 rounded bg-muted" />}>
      <NewProposalPageContent />
    </Suspense>
  );
}
