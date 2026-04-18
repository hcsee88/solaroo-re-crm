"use client";
export const dynamic = "force-dynamic";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  Trophy,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { get, post, patch } from "@/lib/api-client";
import { MilestonesPanel } from "@/components/contracts/milestones-panel";
import { InvoicesPanel } from "@/components/contracts/invoices-panel";
import { VariancePanel } from "@/components/contracts/variance-panel";
import { LinkedDocsSection } from "@/components/documents/linked-docs-section";
import { AuditTrail } from "@/components/audit/audit-trail";

// ─── Types (mirror backend ContractDetail) ────────────────────────────────────

type ContractStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "AWARDED"
  | "SIGNED"
  | "ACTIVE"
  | "CLOSED"
  | "DISPUTED"
  | "TERMINATED";

type HandoverStatus = "NOT_STARTED" | "READY" | "IN_PROGRESS" | "COMPLETED";

type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  completedAt: string | null;
  completedById: string | null;
};

type ContractDetail = {
  id: string;
  contractNo: string;
  title: string;
  status: ContractStatus;
  handoverStatus: HandoverStatus;
  contractValue: string;
  currency: string;
  awardedDate: string | null;
  signedDate: string | null;
  commencementDate: string | null;
  targetCod: string | null;
  completionDate: string | null;
  scopeSummary: string | null;
  paymentTerms: string | null;
  notes: string | null;
  retentionPercent: string | null;
  defectsLiabilityMonths: number | null;
  account: { id: string; accountCode: string; name: string };
  opportunity: { id: string; opportunityCode: string; title: string } | null;
  site: { id: string; siteCode: string; name: string } | null;
  proposalVersion: { id: string; versionNo: number; title: string } | null;
  project: { id: string; projectCode: string } | null;
  projectManagerCandidate: { id: string; name: string } | null;
  handoverCompletedAt: string | null;
  handoverCompletedBy: { id: string; name: string } | null;
  handoverChecklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
};

// ─── Visual config ────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<ContractStatus, string> = {
  DRAFT:        "bg-gray-100 text-gray-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  AWARDED:      "bg-green-100 text-green-700",
  SIGNED:       "bg-blue-100 text-blue-700",
  ACTIVE:       "bg-blue-100 text-blue-700",
  CLOSED:       "bg-gray-100 text-gray-500",
  DISPUTED:     "bg-red-100 text-red-700",
  TERMINATED:   "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT:        "Draft",
  UNDER_REVIEW: "Under Review",
  AWARDED:      "Awarded",
  SIGNED:       "Signed",
  ACTIVE:       "Active",
  CLOSED:       "Closed",
  DISPUTED:     "Disputed",
  TERMINATED:   "Terminated",
};

const HANDOVER_LABELS: Record<HandoverStatus, string> = {
  NOT_STARTED: "Not started",
  READY:       "Ready for handover",
  IN_PROGRESS: "Handover in progress",
  COMPLETED:   "Handover completed",
};

const HANDOVER_STEPS: HandoverStatus[] = ["NOT_STARTED", "READY", "IN_PROGRESS", "COMPLETED"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatMoney(val: string | null, currency: string): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCompletePicker, setShowCompletePicker] = useState(false);
  const [pmUsers, setPmUsers] = useState<{ id: string; name: string; roleName: string }[]>([]);
  const [overridePmId, setOverridePmId] = useState<string>("");
  const [overrideProjectName, setOverrideProjectName] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<ContractDetail>(`/contracts/${id}`);
      setContract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Load PM-eligible users once (for the handover-complete override picker)
  useEffect(() => {
    const PM_ROLES = new Set(["PROJECT_MANAGER", "DIRECTOR", "PMO_MANAGER"]);
    get<{ id: string; name: string; roleName: string }[]>("/admin/users/dropdown")
      .then((u) => setPmUsers(u.filter((x) => PM_ROLES.has(x.roleName))))
      .catch(() => {});
  }, []);

  // Default override PM to the contract candidate when contract loads or picker opens
  useEffect(() => {
    if (showCompletePicker && contract && !overridePmId) {
      setOverridePmId(contract.projectManagerCandidate?.id ?? "");
    }
  }, [showCompletePicker, contract, overridePmId]);

  // ─── Handover actions ──────────────────────────────────────────────────────

  async function runAction(fn: () => Promise<unknown>, label: string) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
                  ?? (err as Error)?.message
                  ?? `Failed: ${label}`;
      setActionError(msg);
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (error || !contract) {
    return (
      <div className="p-6 space-y-3">
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm" style={{ color: "#676879" }}>
          <ArrowLeft className="w-4 h-4" /> Back to contracts
        </Link>
        <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error ?? "Not found"}</div>
      </div>
    );
  }

  const c = contract;
  const stepIndex = HANDOVER_STEPS.indexOf(c.handoverStatus);
  const totalChecklist = c.handoverChecklist.length;
  const doneChecklist = c.handoverChecklist.filter((i) => i.done).length;

  // Determine which actions are available
  const canMarkAwarded = c.status === "DRAFT" || c.status === "UNDER_REVIEW";
  const canMarkReady = c.handoverStatus === "NOT_STARTED" && ["AWARDED", "SIGNED", "ACTIVE"].includes(c.status);
  const canBegin = c.handoverStatus === "READY";
  const canComplete = c.handoverStatus === "IN_PROGRESS" && doneChecklist === totalChecklist && totalChecklist > 0;

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      {/* Top nav */}
      <div className="flex items-center gap-3">
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm" style={{ color: "#676879" }}>
          <ArrowLeft className="w-4 h-4" /> Back to contracts
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>{c.contractNo}</h1>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[c.status]}`}>
              {STATUS_LABELS[c.status]}
            </span>
          </div>
          <p className="text-base mt-1" style={{ color: "#323338" }}>{c.title}</p>
          <div className="text-xs mt-1" style={{ color: "#676879" }}>
            {c.account.name}
            {c.opportunity && (
              <>
                {" · "}
                <Link href={`/opportunities/${c.opportunity.id}`} style={{ color: "#0073ea" }}>
                  {c.opportunity.opportunityCode}
                </Link>
              </>
            )}
            {c.project && (
              <>
                {" · "}
                <Link href={`/projects/${c.project.id}`} style={{ color: "#0073ea" }}>
                  Project {c.project.projectCode} <ExternalLink className="inline w-3 h-3" />
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canMarkAwarded && (
            <button
              onClick={() => runAction(
                () => patch(`/contracts/${c.id}/status`, { toStatus: "AWARDED" }),
                "Mark awarded",
              )}
              disabled={busy}
              className="text-sm font-medium text-white px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "#00ca72" }}
            >
              <Trophy className="inline w-4 h-4 mr-1" /> Mark as Awarded
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md p-3 text-sm flex items-start gap-2" style={{ background: "#fde8ec", color: "#a52840" }}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Handover progress strip */}
      <div className="rounded-xl bg-white p-5" style={{ border: "1px solid hsl(218 23% 91%)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#323338" }}>Award → Handover Workflow</h2>
          <span className="text-xs" style={{ color: "#676879" }}>
            {HANDOVER_LABELS[c.handoverStatus]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {HANDOVER_STEPS.map((step, idx) => {
            const reached = idx <= stepIndex;
            const isCurrent = idx === stepIndex;
            return (
              <div key={step} className="flex-1 flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-2 py-1 rounded-md flex-1"
                  style={{
                    background: isCurrent ? "#dce9fc" : reached ? "#e8f8ef" : "#f5f6f8",
                    color: isCurrent ? "#0073ea" : reached ? "#00854f" : "#a3a8b5",
                    border: isCurrent ? "1px solid #0073ea" : "1px solid transparent",
                  }}
                >
                  {reached ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  <span className="text-xs font-medium">{HANDOVER_LABELS[step]}</span>
                </div>
                {idx < HANDOVER_STEPS.length - 1 && (
                  <div className="w-4 h-px flex-shrink-0" style={{ background: reached ? "#00ca72" : "hsl(218 23% 88%)" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Action row for handover */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canMarkReady && (
            <button
              onClick={() => runAction(
                () => post(`/contracts/${c.id}/handover/ready`, {}),
                "Mark handover ready",
              )}
              disabled={busy}
              className="text-sm font-medium text-white px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "#0073ea" }}
            >
              Mark Ready for Handover
            </button>
          )}
          {canBegin && (
            <button
              onClick={() => runAction(
                () => post(`/contracts/${c.id}/handover/begin`, {}),
                "Begin handover",
              )}
              disabled={busy}
              className="text-sm font-medium text-white px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "#0073ea" }}
            >
              <PlayCircle className="inline w-4 h-4 mr-1" /> Begin Handover
            </button>
          )}
          {c.handoverStatus === "IN_PROGRESS" && !showCompletePicker && (
            <button
              onClick={() => setShowCompletePicker(true)}
              disabled={busy || !canComplete}
              title={!canComplete ? `Complete all ${totalChecklist} checklist items first` : ""}
              className="text-sm font-medium text-white px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#00ca72" }}
            >
              Complete Handover & Activate Project
            </button>
          )}
          {c.handoverStatus === "COMPLETED" && c.project && (
            <Link
              href={`/projects/${c.project.id}`}
              className="text-sm font-medium px-3 py-1.5 rounded-md"
              style={{ background: "#dce9fc", color: "#0073ea" }}
            >
              Open project {c.project.projectCode} →
            </Link>
          )}
        </div>

        {/* Inline picker shown when user clicks "Complete Handover" — lets PMO
            override the PM and project name without editing the contract first. */}
        {showCompletePicker && c.handoverStatus === "IN_PROGRESS" && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: "#f5f6f8", border: "1px solid hsl(218 23% 88%)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#323338" }}>
              Confirm handover & project creation
            </h3>
            <p className="text-xs mb-3" style={{ color: "#676879" }}>
              {c.project
                ? `An existing project (${c.project.projectCode}) will be linked to this contract.`
                : "A new project will be created and linked to this contract using the values below."}
            </p>
            {!c.project && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
                    Project Manager
                  </label>
                  <select
                    value={overridePmId}
                    onChange={(e) => setOverridePmId(e.target.value)}
                    className="w-full bg-white border rounded-md px-2 py-1 text-sm"
                    style={{ borderColor: "hsl(218 23% 91%)" }}
                  >
                    <option value="">— Select PM —</option>
                    {pmUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.roleName})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
                    Project name <span style={{ color: "#a3a8b5" }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={overrideProjectName}
                    onChange={(e) => setOverrideProjectName(e.target.value)}
                    placeholder={c.title}
                    className="w-full bg-white border rounded-md px-2 py-1 text-sm"
                    style={{ borderColor: "hsl(218 23% 91%)" }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCompletePicker(false); setOverridePmId(""); setOverrideProjectName(""); }}
                disabled={busy}
                className="text-sm px-3 py-1.5 rounded-md border"
                style={{ borderColor: "hsl(218 23% 91%)", color: "#676879", background: "#fff" }}
              >
                Cancel
              </button>
              <button
                onClick={() => runAction(
                  () => post(`/contracts/${c.id}/handover/complete`, {
                    ...(overridePmId         && { projectManagerId: overridePmId }),
                    ...(overrideProjectName  && { projectName: overrideProjectName.trim() }),
                  }).then(() => {
                    setShowCompletePicker(false);
                    setOverridePmId("");
                    setOverrideProjectName("");
                  }),
                  "Complete handover",
                )}
                disabled={busy || (!c.project && !overridePmId && !c.projectManagerCandidate)}
                className="text-sm font-medium text-white px-4 py-1.5 rounded-md disabled:opacity-50"
                style={{ background: "#00ca72" }}
              >
                Confirm & Complete Handover
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: facts */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Commercial">
            <Row label="Value" value={formatMoney(c.contractValue, c.currency)} />
            <Row label="Awarded" value={formatDate(c.awardedDate)} />
            <Row label="Signed" value={formatDate(c.signedDate)} />
            <Row label="Commencement" value={formatDate(c.commencementDate)} />
            <Row label="Target COD" value={formatDate(c.targetCod)} />
            <Row label="Payment terms" value={c.paymentTerms ?? "—"} />
          </Card>

          <Card title="Linked records">
            <Row label="Account" value={
              <Link href={`/accounts/${c.account.id}`} style={{ color: "#0073ea" }}>{c.account.name}</Link>
            } />
            <Row label="Opportunity" value={
              c.opportunity ? (
                <Link href={`/opportunities/${c.opportunity.id}`} style={{ color: "#0073ea" }}>
                  {c.opportunity.opportunityCode}
                </Link>
              ) : "—"
            } />
            <Row label="Site" value={c.site ? `${c.site.siteCode} — ${c.site.name}` : "—"} />
            <Row label="Proposal version" value={
              c.proposalVersion
                ? `v${c.proposalVersion.versionNo} — ${c.proposalVersion.title}`
                : "—"
            } />
            <Row label="Project" value={
              c.project ? (
                <Link href={`/projects/${c.project.id}`} style={{ color: "#0073ea" }}>
                  {c.project.projectCode}
                </Link>
              ) : "—"
            } />
            <Row label="PM (candidate)" value={c.projectManagerCandidate?.name ?? "—"} />
          </Card>

          {c.handoverCompletedAt && (
            <Card title="Handover completed">
              <Row label="At" value={formatDate(c.handoverCompletedAt)} />
              <Row label="By" value={c.handoverCompletedBy?.name ?? "—"} />
            </Card>
          )}
        </div>

        {/* Middle/right: scope + checklist */}
        <div className="lg:col-span-2 space-y-4">
          {(c.scopeSummary || c.notes) && (
            <Card title="Scope & notes">
              {c.scopeSummary && (
                <div className="text-sm whitespace-pre-line" style={{ color: "#323338" }}>{c.scopeSummary}</div>
              )}
              {c.notes && (
                <div className="text-sm whitespace-pre-line mt-3 pt-3" style={{ color: "#676879", borderTop: "1px solid hsl(218 23% 93%)" }}>
                  <strong className="text-xs uppercase tracking-wider" style={{ color: "#a3a8b5" }}>Notes</strong>
                  <div className="mt-1">{c.notes}</div>
                </div>
              )}
            </Card>
          )}

          <Card
            title={`Handover checklist (${doneChecklist}/${totalChecklist})`}
          >
            {c.handoverChecklist.length === 0 ? (
              <p className="text-sm" style={{ color: "#676879" }}>
                Checklist will appear once the contract is marked Ready for Handover.
              </p>
            ) : (
              <ul className="space-y-2">
                {c.handoverChecklist.map((item) => {
                  const interactive = c.handoverStatus === "READY" || c.handoverStatus === "IN_PROGRESS";
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => interactive && runAction(
                          () => patch(`/contracts/${c.id}/handover/checklist`, { key: item.key, done: !item.done }),
                          "Update checklist",
                        )}
                        disabled={!interactive || busy}
                        className="w-full flex items-start gap-3 rounded-md px-3 py-2 text-left transition-colors"
                        style={{
                          background: item.done ? "#e8f8ef" : "#f5f6f8",
                          color: item.done ? "#00854f" : "#323338",
                          cursor: interactive ? "pointer" : "default",
                          opacity: !interactive ? 0.85 : 1,
                        }}
                      >
                        {item.done ? (
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#a3a8b5" }} />
                        )}
                        <div className="flex-1">
                          <div className={`text-sm ${item.done ? "line-through" : "font-medium"}`}>
                            {item.label}
                          </div>
                          {item.done && item.completedAt && (
                            <div className="text-xs mt-0.5" style={{ color: "#676879" }}>
                              Completed {formatDate(item.completedAt)}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Variance — contracted vs invoiced vs paid (gated on contract:view_value) */}
      <VariancePanel contractId={c.id} />

      {/* Milestones — invoice trigger schedule */}
      <MilestonesPanel
        contractId={c.id}
        currency={c.currency}
        canEdit={c.handoverStatus !== "COMPLETED" || c.status === "ACTIVE"}
      />

      {/* Invoices — links to milestones, status workflow */}
      <InvoicesPanel
        contractId={c.id}
        currency={c.currency}
        canEdit={true}
      />

      {/* Linked documents (signed contract PDF, etc.) */}
      <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#676879" }}>
          Documents
        </h3>
        <LinkedDocsSection contextType="contract" contextId={c.id} canUpload canDelete={false} />
      </div>

      {/* Per-contract audit trail (gated on audit_log:view) */}
      <AuditTrail resource="contract" resourceId={c.id} pageSize={20} />
    </div>
  );
}

// ─── Reusable building blocks ────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#676879" }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs" style={{ color: "#676879" }}>{label}</span>
      <span className="text-sm text-right" style={{ color: "#323338" }}>{value}</span>
    </div>
  );
}
