"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  DRAFT:        "bg-gray-100 text-gray-700",
  SUBMITTED:    "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED:     "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-700",
  SUPERSEDED:   "bg-gray-100 text-gray-400",
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

// ─── Approval chain component ─────────────────────────────────────────────────

function ApprovalChain({ approvals }: { approvals: ApprovalItem[] }) {
  if (approvals.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Chain</p>
      <div className="flex items-start gap-3 flex-wrap">
        {approvals.map((a, idx) => (
          <div key={a.id} className="flex items-start gap-2">
            {idx > 0 && <span className="mt-4 text-muted-foreground text-xs">→</span>}
            <div className={`rounded-lg border p-3 min-w-[160px] ${
              a.decision === "APPROVED" ? "border-green-200 bg-green-50" :
              a.decision === "REJECTED" ? "border-red-200 bg-red-50" :
              a.decision === "RETURNED" ? "border-yellow-200 bg-yellow-50" :
              "border-border bg-muted/30"
            }`}>
              <p className="text-xs font-medium">{a.approver.name}</p>
              <p className="text-xs text-muted-foreground">{a.approver.role.displayName}</p>
              <div className="mt-1.5">
                {a.decision ? (
                  <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                    a.decision === "APPROVED" ? "bg-green-100 text-green-700" :
                    a.decision === "REJECTED" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {a.decision}
                  </span>
                ) : (
                  <span className="inline-block text-xs text-muted-foreground italic">Pending</span>
                )}
              </div>
              {a.comments && (
                <p className="mt-1.5 text-xs text-muted-foreground italic">"{a.comments}"</p>
              )}
              {a.decidedAt && (
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.decidedAt)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Decision modal ───────────────────────────────────────────────────────────

type Decision = "APPROVED" | "REJECTED" | "RETURNED";

function DecisionModal({
  onClose,
  onSubmit,
}: {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-background border shadow-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Record Approval Decision</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {(["APPROVED", "RETURNED", "REJECTED"] as Decision[]).map((d) => (
              <label key={d} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  value={d}
                  checked={decision === d}
                  onChange={() => setDecision(d)}
                  className="accent-primary"
                />
                <span className={`text-sm font-medium ${
                  d === "APPROVED" ? "text-green-700" :
                  d === "REJECTED" ? "text-red-700" :
                  "text-yellow-700"
                }`}>
                  {d === "APPROVED" ? "Approve" : d === "RETURNED" ? "Return for Revision" : "Reject"}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Comments {requiresComments && <span className="text-destructive">*</span>}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder={requiresComments ? "Explain the reason for this decision…" : "Optional notes…"}
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                decision === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                decision === "REJECTED" ? "bg-red-600 hover:bg-red-700" :
                "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              {submitting ? "Submitting…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New version modal ────────────────────────────────────────────────────────

function NewVersionModal({
  proposalTitle,
  onClose,
  onSubmit,
}: {
  proposalTitle: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    estimatedCapex?: number;
    marginPercent?: number;
    estimatedSavings?: number;
    paybackYears?: number;
    technicalSummary?: string;
    commercialSummary?: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(proposalTitle);
  const [capex, setCapex] = useState("");
  const [margin, setMargin] = useState("");
  const [savings, setSavings] = useState("");
  const [payback, setPayback] = useState("");
  const [techSummary, setTechSummary] = useState("");
  const [commSummary, setCommSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        estimatedCapex:   capex   ? parseFloat(capex)   : undefined,
        marginPercent:    margin  ? parseFloat(margin)   : undefined,
        estimatedSavings: savings ? parseFloat(savings)  : undefined,
        paybackYears:     payback ? parseFloat(payback)  : undefined,
        technicalSummary:  techSummary.trim()  || undefined,
        commercialSummary: commSummary.trim()  || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create version");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-background border shadow-xl p-6 space-y-4 my-8">
        <h2 className="text-lg font-semibold">New Proposal Version</h2>
        <p className="text-sm text-muted-foreground">Previous approved version will be superseded.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Version Title <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">CAPEX (MYR)</label>
              <input type="number" min={0} step="1000" value={capex} onChange={(e) => setCapex(e.target.value)}
                placeholder="e.g. 2500000"
                className="w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Margin (%)</label>
              <input type="number" min={0} max={100} step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)}
                placeholder="e.g. 18"
                className="w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Annual Savings (MYR)</label>
              <input type="number" min={0} step="1000" value={savings} onChange={(e) => setSavings(e.target.value)}
                className="w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Payback (years)</label>
              <input type="number" min={0} max={99} step="0.5" value={payback} onChange={(e) => setPayback(e.target.value)}
                className="w-full h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Technical Summary</label>
            <textarea value={techSummary} onChange={(e) => setTechSummary(e.target.value)} rows={2}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Commercial Summary</label>
            <textarea value={commSummary} onChange={(e) => setCommSummary(e.target.value)} rows={2}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
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
  const [submitting, setSubmitting] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(version.approvalStatus !== "SUPERSEDED");

  const canSubmit = version.allowedActions.includes("submit");
  const canApprove = version.allowedActions.includes("approve");

  async function handleSubmitForApproval() {
    if (!confirm("Submit this version for approval? The approval chain will be created.")) return;
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
          onClose={() => setShowDecisionModal(false)}
          onSubmit={handleDecision}
        />
      )}

      <div className={`rounded-lg border ${
        version.approvalStatus === "APPROVED"    ? "border-green-200 bg-green-50/30" :
        version.approvalStatus === "REJECTED"    ? "border-red-200 bg-red-50/30" :
        version.approvalStatus === "SUPERSEDED"  ? "border-border opacity-60" :
        version.approvalStatus === "DRAFT"       ? "border-border bg-card" :
        "border-blue-200 bg-blue-50/20"
      }`}>
        {/* Version header */}
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-1">
            <span className="font-mono text-sm font-semibold">v{version.versionNo}</span>
            <StatusBadge status={version.approvalStatus} />
            <span className="text-sm text-muted-foreground">{version.title}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {version.estimatedCapex && (
              <span className="font-medium text-foreground">{formatMYR(version.estimatedCapex)}</span>
            )}
            {version.marginPercent && (
              <span>{parseFloat(version.marginPercent).toFixed(1)}% margin</span>
            )}
            <span className="text-xs">{formatDate(version.createdAt)}</span>
            <span className="text-muted-foreground">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* Figures grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">CAPEX</p>
                <p className="text-sm font-medium">{formatMYR(version.estimatedCapex)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margin</p>
                <p className="text-sm font-medium">
                  {version.marginPercent ? `${parseFloat(version.marginPercent).toFixed(1)}%` : "—"}
                  {version.estimatedMargin && (
                    <span className="ml-1 text-xs text-muted-foreground">({formatMYR(version.estimatedMargin)})</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual Savings</p>
                <p className="text-sm font-medium">{formatMYR(version.estimatedSavings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payback</p>
                <p className="text-sm font-medium">
                  {version.paybackYears ? `${parseFloat(version.paybackYears).toFixed(1)} yrs` : "—"}
                </p>
              </div>
            </div>

            {/* Summaries */}
            {(version.technicalSummary || version.commercialSummary) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {version.technicalSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Technical Summary</p>
                    <p className="text-sm whitespace-pre-wrap">{version.technicalSummary}</p>
                  </div>
                )}
                {version.commercialSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Commercial Summary</p>
                    <p className="text-sm whitespace-pre-wrap">{version.commercialSummary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Approval chain */}
            {version.approvals.length > 0 && (
              <ApprovalChain approvals={version.approvals} />
            )}

            {/* Timestamps */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {version.submittedForApprovalAt && (
                <span>Submitted: {formatDate(version.submittedForApprovalAt)}</span>
              )}
              {version.approvedAt && (
                <span>Approved: {formatDate(version.approvedAt)}</span>
              )}
            </div>

            {/* Actions */}
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}

            {(canSubmit || canApprove) && (
              <div className="flex gap-2 pt-1">
                {canSubmit && (
                  <button
                    onClick={handleSubmitForApproval}
                    disabled={submitting}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit for Approval"}
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
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  async function handleNewVersion(data: {
    title: string;
    estimatedCapex?: number;
    marginPercent?: number;
    estimatedSavings?: number;
    paybackYears?: number;
    technicalSummary?: string;
    commercialSummary?: string;
  }) {
    await post(`/proposals/${id}/versions`, data);
    setShowNewVersionModal(false);
    fetchProposal();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
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

  const latestVersion = proposal.versions[0] ?? null;
  const canCreateNewVersion = latestVersion?.allowedActions.includes("new_version") ?? false;

  return (
    <div className="space-y-6">
      {/* Modals */}
      {showNewVersionModal && (
        <NewVersionModal
          proposalTitle={proposal.title}
          onClose={() => setShowNewVersionModal(false)}
          onSubmit={handleNewVersion}
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
        <div>
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

      {/* Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Opportunity</p>
          <Link
            href={`/opportunities/${proposal.opportunity.id}`}
            className="text-sm font-medium hover:text-primary hover:underline"
          >
            {proposal.opportunity.opportunityCode}
          </Link>
          <p className="text-xs text-muted-foreground">{proposal.opportunity.title}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Account</p>
          <Link
            href={`/accounts/${proposal.account.id}`}
            className="text-sm font-medium hover:text-primary hover:underline"
          >
            {proposal.account.name}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Site</p>
          <p className="text-sm font-medium">{proposal.site.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{proposal.site.siteCode}</p>
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
