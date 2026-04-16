"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get, post, patch } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

type ApprovalItem = {
  id: string;
  approvalOrder: number;
  approver: { id: string; name: string; role: { displayName: string } };
  decision: string | null;
  comments: string | null;
  decidedAt: string | null;
  requestedAt: string;
};

type ProposalVersion = {
  id: string;
  proposalId: string;
  versionNo: number;
  title: string;
  approvalStatus: ApprovalStatus;
  estimatedCapex: string | null;
  estimatedMargin: string | null;
  marginPercent: string | null;
  estimatedSavings: string | null;
  paybackYears: string | null;
  technicalSummary: string | null;
  commercialSummary: string | null;
  submittedForApprovalAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  approvals: ApprovalItem[];
  allowedActions: string[];
};

type ProposalDetail = {
  id: string;
  proposalCode: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  opportunity: { id: string; opportunityCode: string; title: string };
  account: { id: string; accountCode: string; name: string };
  site: { id: string; siteCode: string; name: string };
  versions: ProposalVersion[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<ApprovalStatus, string> = {
  DRAFT:        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SUBMITTED:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  REJECTED:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SUPERSEDED:   "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  DRAFT:        "Draft",
  SUBMITTED:    "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED:     "Approved",
  REJECTED:     "Rejected",
  SUPERSEDED:   "Superseded",
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatMYR(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `RM ${n.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatDate(val: string | null): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Status attention banner ──────────────────────────────────────────────────
// Shown at top of page when latest version needs action from someone.

function StatusBanner({ version }: { version: ProposalVersion }) {
  const s = version.approvalStatus;

  if (s === "DRAFT") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40 px-4 py-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Draft v{version.versionNo} — ready to submit for approval when complete.
        </span>
      </div>
    );
  }

  if (s === "SUBMITTED" || s === "UNDER_REVIEW") {
    // Find the next approver: lowest order with no decision, after all prior orders are APPROVED
    const sortedApprovals = [...version.approvals].sort((a, b) => a.approvalOrder - b.approvalOrder);
    let nextApprover: ApprovalItem | null = null;
    for (const a of sortedApprovals) {
      if (!a.decision) { nextApprover = a; break; }
      if (a.decision !== "APPROVED") break; // chain broken
    }

    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
        <span className="mt-0.5 text-amber-500">⏳</span>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Awaiting approval — v{version.versionNo}
          </p>
          {nextApprover && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Next: <span className="font-medium">{nextApprover.approver.name}</span>
              {" "}({nextApprover.approver.role.displayName})
            </p>
          )}
        </div>
      </div>
    );
  }

  if (s === "APPROVED") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 px-4 py-3">
        <span className="text-green-600">✓</span>
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
          Approved v{version.versionNo}
          {version.approvedAt && (
            <span className="font-normal text-green-700 dark:text-green-400">
              {" "}on {formatDate(version.approvedAt)}
            </span>
          )}
        </p>
      </div>
    );
  }

  if (s === "REJECTED") {
    const rejector = version.approvals.find((a) => a.decision === "REJECTED");
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
        <span className="mt-0.5 text-red-500">✕</span>
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            v{version.versionNo} rejected
            {rejector && ` by ${rejector.approver.name}`}
          </p>
          {rejector?.comments && (
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5 italic">"{rejector.comments}"</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Approval chain ───────────────────────────────────────────────────────────

function ApprovalChain({ approvals }: { approvals: ApprovalItem[] }) {
  if (approvals.length === 0) return null;

  const sortedApprovals = [...approvals].sort((a, b) => a.approvalOrder - b.approvalOrder);

  // Find the index of the "next" approver (first with no decision and all prior approved)
  let nextApproverIdx = -1;
  for (let i = 0; i < sortedApprovals.length; i++) {
    const a = sortedApprovals[i];
    if (a && !a.decision) {
      // Check all prior are approved
      const allPriorApproved = sortedApprovals.slice(0, i).every((p) => p.decision === "APPROVED");
      if (allPriorApproved) { nextApproverIdx = i; break; }
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Chain</p>
      <div className="flex items-start gap-3 flex-wrap">
        {sortedApprovals.map((a, idx) => {
          const isNext = idx === nextApproverIdx;
          return (
            <div key={a.id} className="flex items-start gap-2">
              {idx > 0 && <span className="mt-4 text-muted-foreground text-sm">→</span>}
              <div className={`rounded-lg border p-3 min-w-[164px] transition-all ${
                a.decision === "APPROVED" ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" :
                a.decision === "REJECTED" ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" :
                a.decision === "RETURNED" ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" :
                isNext                   ? "border-amber-300 bg-amber-50 ring-1 ring-amber-300 dark:border-amber-700 dark:bg-amber-900/20" :
                                           "border-border bg-muted/30"
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold leading-tight">{a.approver.name}</p>
                    <p className="text-xs text-muted-foreground">{a.approver.role.displayName}</p>
                  </div>
                  {isNext && !a.decision && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">
                      Waiting
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  {a.decision ? (
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                      a.decision === "APPROVED" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                      a.decision === "REJECTED" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}>
                      {a.decision === "APPROVED" ? "Approved" : a.decision === "REJECTED" ? "Rejected" : "Returned"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Pending</span>
                  )}
                </div>
                {a.comments && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2" title={a.comments}>
                    "{a.comments}"
                  </p>
                )}
                {a.decidedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.decidedAt)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Decision modal ───────────────────────────────────────────────────────────

type Decision = "APPROVED" | "REJECTED" | "RETURNED";

function DecisionModal({
  versionNo,
  onClose,
  onSubmit,
}: {
  versionNo: number;
  onClose: () => void;
  onSubmit: (decision: Decision, comments: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<Decision>("APPROVED");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresComments = decision === "REJECTED" || decision === "RETURNED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiresComments && !comments.trim()) {
      setError("Comments are required when rejecting or returning");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(decision, comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
      setSubmitting(false);
    }
  }

  const DECISION_OPTIONS: { value: Decision; label: string; colour: string; bg: string }[] = [
    { value: "APPROVED", label: "Approve",             colour: "text-green-700", bg: "border-green-200 bg-green-50/50" },
    { value: "RETURNED", label: "Return for Revision", colour: "text-amber-700", bg: "border-amber-200 bg-amber-50/50" },
    { value: "REJECTED", label: "Reject",              colour: "text-red-700",   bg: "border-red-200 bg-red-50/50" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Record Decision — v{versionNo}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            This decision is permanent and will be logged in the approval audit trail.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Decision selection */}
          <div className="space-y-2">
            {DECISION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-all ${
                  decision === opt.value ? opt.bg + " ring-1 ring-offset-0 ring-primary" : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value={opt.value}
                  checked={decision === opt.value}
                  onChange={() => { setDecision(opt.value); setError(null); }}
                  className="accent-primary"
                />
                <span className={`text-sm font-medium ${opt.colour}`}>{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Comments{" "}
              {requiresComments
                ? <span className="text-destructive">*</span>
                : <span className="text-muted-foreground font-normal text-xs">(optional)</span>}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder={
                decision === "REJECTED" ? "Why is this proposal being rejected?" :
                decision === "RETURNED" ? "What needs to be revised before resubmission?" :
                "Optional notes for the record…"
              }
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y bg-background"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                decision === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                decision === "REJECTED" ? "bg-red-600 hover:bg-red-700" :
                "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {submitting ? "Submitting…" : (
                decision === "APPROVED" ? "Confirm Approval" :
                decision === "REJECTED" ? "Confirm Rejection" :
                "Return for Revision"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New version modal (pre-filled from previous version) ─────────────────────

function NewVersionModal({
  proposalId,
  previousVersion,
  onClose,
  onSuccess,
}: {
  proposalId: string;
  previousVersion: ProposalVersion | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title,       setTitle]       = useState(previousVersion?.title ?? "");
  const [capex,       setCapex]       = useState(previousVersion?.estimatedCapex ? parseFloat(previousVersion.estimatedCapex).toFixed(0) : "");
  const [margin,      setMargin]      = useState(previousVersion?.marginPercent ? parseFloat(previousVersion.marginPercent).toFixed(1) : "");
  const [savings,     setSavings]     = useState(previousVersion?.estimatedSavings ? parseFloat(previousVersion.estimatedSavings).toFixed(0) : "");
  const [payback,     setPayback]     = useState(previousVersion?.paybackYears ? parseFloat(previousVersion.paybackYears).toFixed(1) : "");
  const [techSummary, setTechSummary] = useState(previousVersion?.technicalSummary ?? "");
  const [commSummary, setCommSummary] = useState(previousVersion?.commercialSummary ?? "");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const inputCls = "w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Version title is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { title: title.trim() };
      if (capex)       payload.estimatedCapex    = parseFloat(capex);
      if (margin)      payload.marginPercent     = parseFloat(margin);
      if (savings)     payload.estimatedSavings  = parseFloat(savings);
      if (payback)     payload.paybackYears      = parseFloat(payback);
      if (techSummary.trim()) payload.technicalSummary  = techSummary.trim();
      if (commSummary.trim()) payload.commercialSummary = commSummary.trim();
      await post(`/proposals/${proposalId}/versions`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create version");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl my-8 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold">New Proposal Version</h2>
          {previousVersion && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-filled from v{previousVersion.versionNo} — update what has changed.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Version Title <span className="text-destructive">*</span>
            </label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">CAPEX (MYR)</label>
              <input type="number" min={0} step="1000" value={capex} onChange={(e) => setCapex(e.target.value)}
                placeholder="e.g. 2500000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Margin (%)</label>
              <input type="number" min={0} max={100} step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)}
                placeholder="e.g. 18" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Annual Savings (MYR)</label>
              <input type="number" min={0} step="1000" value={savings} onChange={(e) => setSavings(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Payback (years)</label>
              <input type="number" min={0} max={99} step="0.5" value={payback} onChange={(e) => setPayback(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Technical Summary</label>
            <textarea value={techSummary} onChange={(e) => setTechSummary(e.target.value)} rows={3}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y bg-background" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Commercial Summary</label>
            <textarea value={commSummary} onChange={(e) => setCommSummary(e.target.value)} rows={3}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y bg-background" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "Creating…" : "Create Version"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline edit panel for DRAFT versions ────────────────────────────────────

function EditVersionPanel({
  version,
  proposalId,
  onSaved,
  onCancel,
}: {
  version: ProposalVersion;
  proposalId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title,       setTitle]       = useState(version.title);
  const [capex,       setCapex]       = useState(version.estimatedCapex ? parseFloat(version.estimatedCapex).toFixed(0) : "");
  const [margin,      setMargin]      = useState(version.marginPercent ? parseFloat(version.marginPercent).toFixed(1) : "");
  const [savings,     setSavings]     = useState(version.estimatedSavings ? parseFloat(version.estimatedSavings).toFixed(0) : "");
  const [payback,     setPayback]     = useState(version.paybackYears ? parseFloat(version.paybackYears).toFixed(1) : "");
  const [techSummary, setTechSummary] = useState(version.technicalSummary ?? "");
  const [commSummary, setCommSummary] = useState(version.commercialSummary ?? "");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const inputCls = "w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { title: title.trim() };
      if (capex)       payload.estimatedCapex    = parseFloat(capex);
      else             payload.estimatedCapex    = null;
      if (margin)      payload.marginPercent     = parseFloat(margin);
      else             payload.marginPercent     = null;
      if (savings)     payload.estimatedSavings  = parseFloat(savings);
      else             payload.estimatedSavings  = null;
      if (payback)     payload.paybackYears      = parseFloat(payback);
      else             payload.paybackYears      = null;
      payload.technicalSummary  = techSummary.trim() || null;
      payload.commercialSummary = commSummary.trim() || null;
      await patch(`/proposals/${proposalId}/versions/${version.versionNo}`, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editing v{version.versionNo}</p>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Title <span className="text-destructive">*</span>
        </label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">CAPEX (MYR)</label>
          <input type="number" min={0} step="1000" value={capex} onChange={(e) => setCapex(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Margin (%)</label>
          <input type="number" min={0} max={100} step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Annual Savings (MYR)</label>
          <input type="number" min={0} step="1000" value={savings} onChange={(e) => setSavings(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Payback (years)</label>
          <input type="number" min={0} max={99} step="0.5" value={payback} onChange={(e) => setPayback(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Technical Summary</label>
        <textarea value={techSummary} onChange={(e) => setTechSummary(e.target.value)} rows={3}
          className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y bg-background" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Commercial Summary</label>
        <textarea value={commSummary} onChange={(e) => setCommSummary(e.target.value)} rows={3}
          className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y bg-background" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Version card ─────────────────────────────────────────────────────────────

function VersionCard({
  version,
  proposalId,
  onRefresh,
}: {
  version: ProposalVersion;
  proposalId: string;
  onRefresh: () => void;
}) {
  const [submitting,       setSubmitting]       = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [actionError,      setActionError]      = useState<string | null>(null);
  const [expanded,         setExpanded]         = useState(version.approvalStatus !== "SUPERSEDED");

  const canSubmit = version.allowedActions.includes("submit");
  const canApprove = version.allowedActions.includes("approve");
  const canEdit   = version.allowedActions.includes("edit");

  async function handleSubmitForApproval() {
    if (!confirm("Submit this version for approval? The approval chain will be created and you will no longer be able to edit it.")) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await patch(`/proposals/${proposalId}/versions/${version.versionNo}/submit`, {});
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(decision: "APPROVED" | "REJECTED" | "RETURNED", comments: string) {
    await post(`/proposals/${proposalId}/versions/${version.versionNo}/decision`, {
      decision,
      comments: comments || undefined,
    });
    setShowDecisionModal(false);
    onRefresh();
  }

  return (
    <>
      {showDecisionModal && (
        <DecisionModal
          versionNo={version.versionNo}
          onClose={() => setShowDecisionModal(false)}
          onSubmit={handleDecision}
        />
      )}

      <div className={`rounded-lg border transition-all ${
        version.approvalStatus === "APPROVED"   ? "border-green-200 bg-green-50/20 dark:border-green-800 dark:bg-green-900/10" :
        version.approvalStatus === "REJECTED"   ? "border-red-200 bg-red-50/20 dark:border-red-800 dark:bg-red-900/10" :
        version.approvalStatus === "SUPERSEDED" ? "border-border opacity-60" :
        version.approvalStatus === "DRAFT"      ? "border-border bg-card" :
        "border-blue-200 bg-blue-50/10 dark:border-blue-800 dark:bg-blue-900/10"
      }`}>

        {/* Version header — click to expand/collapse */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => !editing && setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm font-semibold flex-shrink-0">v{version.versionNo}</span>
            <StatusBadge status={version.approvalStatus} />
            <span className="text-sm text-muted-foreground truncate">{version.title}</span>
          </div>
          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            {version.estimatedCapex && (
              <span className="font-semibold tabular-nums">{formatMYR(version.estimatedCapex)}</span>
            )}
            {version.marginPercent && (
              <span className="text-muted-foreground">{parseFloat(version.marginPercent).toFixed(1)}%</span>
            )}
            <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
            <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && !editing && (
          <div className="border-t px-4 py-4 space-y-5">
            {/* Figures grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">CAPEX</p>
                <p className="text-sm font-semibold tabular-nums">{formatMYR(version.estimatedCapex)}</p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Margin</p>
                <p className="text-sm font-semibold">
                  {version.marginPercent ? `${parseFloat(version.marginPercent).toFixed(1)}%` : "—"}
                  {version.estimatedMargin && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({formatMYR(version.estimatedMargin)})</span>
                  )}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Annual Savings</p>
                <p className="text-sm font-semibold tabular-nums">{formatMYR(version.estimatedSavings)}</p>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Payback</p>
                <p className="text-sm font-semibold">
                  {version.paybackYears ? `${parseFloat(version.paybackYears).toFixed(1)} yrs` : "—"}
                </p>
              </div>
            </div>

            {/* Summaries */}
            {(version.technicalSummary || version.commercialSummary) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {version.technicalSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Technical Summary</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{version.technicalSummary}</p>
                  </div>
                )}
                {version.commercialSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Commercial Summary</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{version.commercialSummary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Approval chain */}
            {version.approvals.length > 0 && (
              <ApprovalChain approvals={version.approvals} />
            )}

            {/* Timestamps */}
            {(version.submittedForApprovalAt || version.approvedAt) && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                {version.submittedForApprovalAt && (
                  <span>Submitted: {formatDate(version.submittedForApprovalAt)}</span>
                )}
                {version.approvedAt && (
                  <span>Approved: {formatDate(version.approvedAt)}</span>
                )}
              </div>
            )}

            {/* Action area */}
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}

            {(canEdit || canSubmit || canApprove) && (
              <div className="flex flex-wrap gap-2 pt-1 border-t">
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Edit Draft
                  </button>
                )}
                {canSubmit && (
                  <button
                    onClick={handleSubmitForApproval}
                    disabled={submitting}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit for Approval →"}
                  </button>
                )}
                {canApprove && (
                  <button
                    onClick={() => setShowDecisionModal(true)}
                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    Record Decision
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline edit panel */}
        {editing && (
          <EditVersionPanel
            version={version}
            proposalId={proposalId}
            onSaved={() => { setEditing(false); onRefresh(); }}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [proposal,            setProposal]            = useState<ProposalDetail | null>(null);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState<string | null>(null);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);

  const fetchProposal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<ProposalDetail>(`/proposals/${id}`);
      setProposal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Proposal not found"}
      </div>
    );
  }

  const latestVersion       = proposal.versions[0] ?? null;
  const canCreateNewVersion = latestVersion?.allowedActions.includes("new_version") ?? false;

  // Find the version that is the active decision point (SUBMITTED or UNDER_REVIEW)
  const activeVersion = proposal.versions.find(
    (v) => v.approvalStatus === "SUBMITTED" || v.approvalStatus === "UNDER_REVIEW",
  ) ?? latestVersion;

  return (
    <div className="space-y-6">
      {/* New version modal */}
      {showNewVersionModal && (
        <NewVersionModal
          proposalId={id}
          previousVersion={latestVersion}
          onClose={() => setShowNewVersionModal(false)}
          onSuccess={fetchProposal}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/proposals" className="hover:text-foreground">← Proposals</Link>
        <span>/</span>
        <span className="font-mono">{proposal.proposalCode}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-muted-foreground">{proposal.proposalCode}</span>
            {latestVersion && <StatusBadge status={latestVersion.approvalStatus} />}
          </div>
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
        </div>

        {canCreateNewVersion && (
          <button
            onClick={() => setShowNewVersionModal(true)}
            className="flex-shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            + New Version
          </button>
        )}
      </div>

      {/* Status attention banner */}
      {activeVersion && <StatusBanner version={activeVersion} />}

      {/* Metadata grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Opportunity</p>
          <Link href={`/opportunities/${proposal.opportunity.id}`}
            className="text-sm font-medium hover:text-primary hover:underline block truncate">
            {proposal.opportunity.opportunityCode}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{proposal.opportunity.title}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Account</p>
          <Link href={`/accounts/${proposal.account.id}`}
            className="text-sm font-medium hover:text-primary hover:underline block truncate">
            {proposal.account.name}
          </Link>
          <p className="text-xs font-mono text-muted-foreground">{proposal.account.accountCode}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Site</p>
          <p className="text-sm font-medium truncate">{proposal.site.name}</p>
          <p className="text-xs font-mono text-muted-foreground">{proposal.site.siteCode}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Versions</p>
          <p className="text-sm font-medium">{proposal.versions.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Created</p>
          <p className="text-sm">{formatDate(proposal.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Last Updated</p>
          <p className="text-sm">{formatDate(proposal.updatedAt)}</p>
        </div>
      </div>

      {/* Versions */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          Versions
          <span className="ml-2 text-sm font-normal text-muted-foreground">({proposal.versions.length})</span>
        </h2>

        {proposal.versions.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-12 text-center text-muted-foreground text-sm">
            No versions yet.
          </div>
        ) : (
          proposal.versions.map((v) => (
            <VersionCard
              key={v.id}
              version={v}
              proposalId={id}
              onRefresh={fetchProposal}
            />
          ))
        )}
      </div>
    </div>
  );
}
