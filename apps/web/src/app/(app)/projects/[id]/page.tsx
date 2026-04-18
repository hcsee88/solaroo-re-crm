"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { get, patch } from "@/lib/api-client";
import { CheckCircle2, Circle, Clock, XCircle, ChevronRight, AlertCircle, Flag, X } from "lucide-react";
import { LinkedDocsSection } from "@/components/documents/linked-docs-section";
import { AuditTrail } from "@/components/audit/audit-trail";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliverableStatus = "PENDING" | "UPLOADED" | "SUBMITTED" | "APPROVED" | "NOT_REQUIRED";

type Deliverable = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  status: DeliverableStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
};

type Gate = {
  id: string;
  gateNo: number;
  gateName: string;
  status: string;
  targetDate: string | null;
  actualDate: string | null;
  remarks: string | null;
  pmoFlagged: boolean;
  pmoComment: string | null;
  owner: { id: string; name: string };
  deliverables: Deliverable[];
};

type RagStatus = "GREEN" | "AMBER" | "RED";

type ProjectDetail = {
  id: string;
  projectNumber: number;
  projectCode: string;
  name: string;
  status: string;
  currentGateNo: number;
  ragStatus: RagStatus;
  currentBlocker: string | null;
  blockerDueDate: string | null;
  blockerOwner: { id: string; name: string } | null;
  startDate: string | null;
  targetCod: string | null;
  actualCod: string | null;
  budgetBaseline: string | null;
  budgetUpdated: string | null;
  notes: string | null;
  account: { id: string; name: string; accountCode: string };
  site: { id: string; name: string; address: string | null };
  projectManager: { id: string; name: string; email: string };
  opportunity: { id: string; title: string; stage: string };
  contract: { id: string; contractNo: string; title: string; status: string; handoverStatus: string } | null;
  gates: Gate[];
  _count: { issues: number; risks: number; milestones: number; variations: number; punchlistItems: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GATE_STATUS_COLOURS: Record<string, string> = {
  NOT_STARTED: "text-muted-foreground",
  IN_PROGRESS: "text-blue-600",
  SUBMITTED:   "text-amber-600",
  APPROVED:    "text-green-600",
  REJECTED:    "text-red-600",
};

const DELIVERABLE_STATUS_COLOURS: Record<DeliverableStatus, string> = {
  PENDING:      "text-muted-foreground",
  UPLOADED:     "text-blue-600",
  SUBMITTED:    "text-amber-600",
  APPROVED:     "text-green-600",
  NOT_REQUIRED: "text-muted-foreground/50",
};

function formatNum(n: number) { return `P${String(n).padStart(3, "0")}`; }
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}
function formatCurrency(v: string | null) {
  if (!v) return "—";
  return `RM ${Number(v).toLocaleString("en-MY", { minimumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    ACTIVE:    "bg-green-100 text-green-800",
    ON_HOLD:   "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colours[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function RagBadge({ status }: { status: RagStatus }) {
  const colours: Record<RagStatus, string> = {
    GREEN: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    AMBER: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    RED:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${colours[status]}`}>
      {status}
    </span>
  );
}

// ─── RAG + Blocker panel ──────────────────────────────────────────────────────

function RagPanel({
  project,
  onUpdated,
}: {
  project: ProjectDetail;
  onUpdated: (updated: ProjectDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ragStatus, setRagStatus] = useState<RagStatus>(project.ragStatus);
  const [currentBlocker, setCurrentBlocker] = useState(project.currentBlocker ?? "");
  const [blockerDueDate, setBlockerDueDate] = useState(
    project.blockerDueDate ? project.blockerDueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOverdue =
    project.blockerDueDate &&
    new Date(project.blockerDueDate) < new Date() &&
    project.ragStatus === "RED";

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patch<ProjectDetail>(`/projects/${project.id}`, {
        ragStatus,
        currentBlocker: currentBlocker.trim() || null,
        blockerDueDate: blockerDueDate ? new Date(blockerDueDate).toISOString() : null,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setRagStatus(project.ragStatus);
    setCurrentBlocker(project.currentBlocker ?? "");
    setBlockerDueDate(project.blockerDueDate ? project.blockerDueDate.slice(0, 10) : "");
    setSaveError(null);
    setEditing(false);
  }

  const inputCls = "w-full h-8 rounded-md border border-input px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 ${project.ragStatus === "RED" ? "border-red-300 dark:border-red-700" : project.ragStatus === "AMBER" ? "border-yellow-300 dark:border-yellow-700" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Project Health</h3>
          <RagBadge status={project.ragStatus} />
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* RAG selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
            <div className="flex gap-2">
              {(["GREEN", "AMBER", "RED"] as RagStatus[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRagStatus(r)}
                  className={`rounded px-3 py-1 text-xs font-semibold border transition-all ${
                    ragStatus === r ? "ring-2 ring-offset-1 ring-primary" : "opacity-60 hover:opacity-100"
                  } ${
                    r === "GREEN" ? "bg-green-100 text-green-800 border-green-200" :
                    r === "AMBER" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                    "bg-red-100 text-red-800 border-red-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Current Blocker</label>
            <input
              type="text"
              value={currentBlocker}
              onChange={(e) => setCurrentBlocker(e.target.value)}
              placeholder="What is blocking progress?"
              maxLength={500}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Blocker Due Date</label>
            <input
              type="date"
              value={blockerDueDate}
              onChange={(e) => setBlockerDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {project.currentBlocker ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Blocker</p>
              <p className="text-sm">{project.currentBlocker}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {project.blockerOwner && <span>{project.blockerOwner.name}</span>}
                {project.blockerDueDate && (
                  <span className={isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
                    {isOverdue ? "⚠ Overdue — " : "Due "}
                    {new Date(project.blockerDueDate).toLocaleDateString("en-MY", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active blocker.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DeliverableIcon({ status }: { status: DeliverableStatus }) {
  if (status === "APPROVED")     return <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />;
  if (status === "SUBMITTED")    return <Clock        className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  if (status === "UPLOADED")     return <Circle       className="w-4 h-4 text-blue-500  flex-shrink-0" />;
  if (status === "NOT_REQUIRED") return <XCircle      className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />;
}

// ─── Deliverable row with quick status toggle ─────────────────────────────────

function DeliverableRow({
  deliverable,
  onStatusChange,
}: {
  deliverable: Deliverable;
  onStatusChange: (id: string, status: DeliverableStatus) => void;
}) {
  const NEXT_STATUS: Record<DeliverableStatus, DeliverableStatus> = {
    PENDING:      "UPLOADED",
    UPLOADED:     "SUBMITTED",
    SUBMITTED:    "APPROVED",
    APPROVED:     "APPROVED",
    NOT_REQUIRED: "NOT_REQUIRED",
  };

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/30 group">
      <button
        onClick={() => {
          const next = NEXT_STATUS[deliverable.status];
          if (next !== deliverable.status) onStatusChange(deliverable.id, next);
        }}
        className="mt-0.5 flex-shrink-0"
        title={`Current: ${deliverable.status}. Click to advance.`}
        disabled={deliverable.status === "APPROVED" || deliverable.status === "NOT_REQUIRED"}
      >
        <DeliverableIcon status={deliverable.status} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{deliverable.code}</span>
          <span className={`text-sm font-medium ${deliverable.status === "NOT_REQUIRED" ? "line-through text-muted-foreground/50" : ""}`}>
            {deliverable.name}
          </span>
          {deliverable.isRequired && deliverable.status === "PENDING" && (
            <span title="Required deliverable">
              <AlertCircle className="w-3 h-3 text-orange-500" />
            </span>
          )}
        </div>
        {deliverable.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{deliverable.description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <select
          value={deliverable.status}
          onChange={(e) => onStatusChange(deliverable.id, e.target.value as DeliverableStatus)}
          className={`text-xs rounded border-0 bg-transparent px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer ${DELIVERABLE_STATUS_COLOURS[deliverable.status]}`}
        >
          <option value="PENDING">Pending</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="NOT_REQUIRED">N/A</option>
        </select>
      </div>
    </div>
  );
}

// ─── Gate Action Modal ────────────────────────────────────────────────────────

type PendingAction = {
  gateNo: number;
  gateName: string;
  newStatus: string;
};

const ACTION_CONFIG: Record<string, {
  title: string;
  description: string;
  remarksLabel: string;
  remarksRequired: boolean;
  confirmLabel: string;
  confirmClass: string;
}> = {
  SUBMITTED: {
    title: "Submit Gate for Approval",
    description: "This will notify the Director and PMO for review. Ensure all required deliverables are uploaded before submitting.",
    remarksLabel: "Submission notes (optional)",
    remarksRequired: false,
    confirmLabel: "Submit for Approval",
    confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  APPROVED: {
    title: "Approve Gate",
    description: "Approving this gate closes it and advances the project. This action is recorded in the audit log.",
    remarksLabel: "Approval remarks (optional)",
    remarksRequired: false,
    confirmLabel: "Approve Gate",
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
  },
  REJECTED: {
    title: "Reject Gate",
    description: "The gate will be returned to the PM for rework. A rejection reason is required.",
    remarksLabel: "Rejection reason",
    remarksRequired: true,
    confirmLabel: "Reject Gate",
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  IN_PROGRESS: {
    title: "Re-open Gate",
    description: "This gate will be moved back to In Progress for the PM to rework deliverables.",
    remarksLabel: "Notes (optional)",
    remarksRequired: false,
    confirmLabel: "Re-open Gate",
    confirmClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
};

function GateActionModal({
  action,
  onConfirm,
  onClose,
  saving,
}: {
  action: PendingAction;
  onConfirm: (gateNo: number, newStatus: string, remarks: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [remarks, setRemarks] = useState("");
  const config = ACTION_CONFIG[action.newStatus];

  if (!config) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(action.gateNo, action.newStatus, remarks.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,26,67,0.4)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        style={{ boxShadow: "0 16px 48px rgba(26,26,67,0.24)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#323338" }}>
              {config.title}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#676879" }}>
              G{action.gateNo}: {action.gateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ color: "#676879" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 94%)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: "#676879" }}>
          {config.description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>
              {config.remarksLabel}
              {config.remarksRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              required={config.remarksRequired}
              rows={3}
              placeholder={config.remarksRequired ? "Required — enter a reason…" : "Add notes for context…"}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ borderColor: "hsl(218 23% 88%)" }}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: "hsl(218 23% 88%)", color: "#676879" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(228 33% 97%)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (config.remarksRequired && !remarks.trim())}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${config.confirmClass}`}
            >
              {saving ? "Saving…" : config.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Gate panel ───────────────────────────────────────────────────────────────

function GatePanel({
  gate,
  projectId,
  isCurrent,
  onDeliverableChange,
  onAdvanceGate,
}: {
  gate: Gate;
  projectId: string;
  isCurrent: boolean;
  onDeliverableChange: (gateNo: number, deliverableId: string, status: DeliverableStatus) => void;
  onAdvanceGate: (gateNo: number, newStatus: string, remarks: string) => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const done    = gate.deliverables.filter((d) => ["UPLOADED", "SUBMITTED", "APPROVED", "NOT_REQUIRED"].includes(d.status)).length;
  const required = gate.deliverables.filter((d) => d.isRequired).length;
  const requiredDone = gate.deliverables.filter((d) => d.isRequired && ["UPLOADED", "SUBMITTED", "APPROVED", "NOT_REQUIRED"].includes(d.status)).length;

  const gateStatusColour = GATE_STATUS_COLOURS[gate.status] ?? "text-muted-foreground";

  const [pendingAction, setPendingAction] = useState<{ newStatus: string } | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  async function handleActionConfirm(gateNo: number, newStatus: string, remarks: string) {
    setActionSaving(true);
    try {
      await onAdvanceGate(gateNo, newStatus, remarks);
      setPendingAction(null);
    } finally {
      setActionSaving(false);
    }
  }

  return (
    <>
    <div className={`rounded-lg border bg-card ${isCurrent ? "ring-2 ring-primary/30" : ""}`}>
      {/* Gate header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
          ${gate.status === "APPROVED" ? "bg-green-600 text-white" : ""}
          ${gate.status === "IN_PROGRESS" ? "bg-primary text-primary-foreground" : ""}
          ${gate.status === "SUBMITTED" ? "bg-amber-500 text-white" : ""}
          ${gate.status === "REJECTED" ? "bg-red-500 text-white" : ""}
          ${gate.status === "NOT_STARTED" ? "bg-muted text-muted-foreground" : ""}
        `}>
          {gate.gateNo}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">G{gate.gateNo}: {gate.gateName}</span>
            {isCurrent && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Active</span>}
            {gate.pmoFlagged && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
                <Flag className="w-3 h-3" />
                PMO Flagged
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className={`text-xs font-medium ${gateStatusColour}`}>{gate.status.replace("_", " ")}</span>
            <span className="text-xs text-muted-foreground">
              {requiredDone}/{required} required · {done}/{gate.deliverables.length} total
            </span>
            {gate.targetDate && (
              <span className="text-xs text-muted-foreground">Due: {formatDate(gate.targetDate)}</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${gate.deliverables.length ? (done / gate.deliverables.length) * 100 : 0}%` }}
          />
        </div>

        <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {/* Deliverables list */}
      {expanded && (
        <div className="border-t">
          <div className="divide-y divide-border/50">
            {gate.deliverables.map((d) => (
              <DeliverableRow
                key={d.id}
                deliverable={d}
                onStatusChange={(id, status) => onDeliverableChange(gate.gateNo, id, status)}
              />
            ))}
          </div>

          {/* Gate remarks / PMO comment */}
          {(gate.remarks || gate.pmoComment) && (
            <div className="px-4 py-3 border-t space-y-2 bg-muted/10">
              {gate.remarks && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Gate notes</p>
                  <p className="text-sm whitespace-pre-wrap">{gate.remarks}</p>
                </div>
              )}
              {gate.pmoComment && (
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-0.5">PMO comment</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{gate.pmoComment}</p>
                </div>
              )}
            </div>
          )}

          {/* Gate actions */}
          {isCurrent && gate.status !== "APPROVED" && (
            <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
              {gate.status === "IN_PROGRESS" && (
                <button
                  onClick={() => setPendingAction({ newStatus: "SUBMITTED" })}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Submit for Approval
                </button>
              )}
              {gate.status === "SUBMITTED" && (
                <>
                  <button
                    onClick={() => setPendingAction({ newStatus: "APPROVED" })}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    Approve Gate
                  </button>
                  <button
                    onClick={() => setPendingAction({ newStatus: "REJECTED" })}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {gate.status === "REJECTED" && (
                <button
                  onClick={() => setPendingAction({ newStatus: "IN_PROGRESS" })}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Re-open Gate
                </button>
              )}
            </div>
          )}

          {/* Per-gate audit trail (silent if user lacks audit_log:view) */}
          <div className="px-4 py-3 border-t">
            <AuditTrail
              resource="project_gate"
              resourceId={`${projectId}:${gate.gateNo}`}
              pageSize={5}
            />
          </div>
        </div>
      )}
    </div>

    {/* Gate action confirmation modal */}
    {pendingAction && (
      <GateActionModal
        action={{ gateNo: gate.gateNo, gateName: gate.gateName, newStatus: pendingAction.newStatus }}
        onConfirm={handleActionConfirm}
        onClose={() => setPendingAction(null)}
        saving={actionSaving}
      />
    )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gates" | "documents">("gates");

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<ProjectDetail>(`/projects/${params.id}`);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleDeliverableChange = async (
    gateNo: number,
    deliverableId: string,
    status: DeliverableStatus,
  ) => {
    try {
      const updated = await patch<ProjectDetail>(
        `/projects/${params.id}/deliverables/${deliverableId}`,
        { status },
      );
      setProject(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update deliverable");
    }
  };

  const handleGateAdvance = async (gateNo: number, newStatus: string, remarks: string) => {
    const updated = await patch<ProjectDetail>(
      `/projects/${params.id}/gates/${gateNo}/status`,
      { status: newStatus, ...(remarks ? { remarks } : {}) },
    );
    setProject(updated);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Project not found"}
      </div>
    );
  }

  const totalDeliverables = project.gates.reduce((s, g) => s + g.deliverables.length, 0);
  const completedDeliverables = project.gates.reduce(
    (s, g) => s + g.deliverables.filter((d) => ["UPLOADED", "SUBMITTED", "APPROVED", "NOT_REQUIRED"].includes(d.status)).length, 0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{formatNum(project.projectNumber)}</span>
            <span className="font-mono text-sm font-semibold">{project.projectCode}</span>
            <StatusBadge status={project.status} />
            <RagBadge status={project.ragStatus} />
          </div>
          <h1 className="text-2xl font-semibold mt-1">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Link href={`/accounts/${project.account.id}`} className="hover:text-primary hover:underline">
              {project.account.name}
            </Link>
            <span>·</span>
            <span>PM: {project.projectManager.name}</span>
            <span>·</span>
            <Link href={`/opportunities/${project.opportunity.id}`} className="hover:text-primary hover:underline">
              {project.opportunity.title}
            </Link>
            {project.contract && (
              <>
                <span>·</span>
                <Link
                  href={`/contracts/${project.contract.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                  title={`${project.contract.title} — ${project.contract.status} · Handover ${project.contract.handoverStatus}`}
                >
                  Contract: {project.contract.contractNo}
                </Link>
              </>
            )}
          </div>
        </div>
        <Link
          href={`/projects/${project.id}/edit`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
        {/* Left — Tabs: Gates | Documents */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="border-b">
            <nav className="-mb-px flex gap-6">
              {[
                { key: "gates",     label: "Gate Progress" },
                { key: "documents", label: "Documents" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as "gates" | "documents")}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Gates tab */}
          {activeTab === "gates" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Gate Progress</h2>
                <span className="text-sm text-muted-foreground">
                  {completedDeliverables}/{totalDeliverables} deliverables done
                </span>
              </div>
              {project.gates.map((gate) => (
                <GatePanel
                  key={gate.id}
                  gate={gate}
                  projectId={project.id}
                  isCurrent={gate.gateNo === project.currentGateNo}
                  onDeliverableChange={handleDeliverableChange}
                  onAdvanceGate={(gateNo, newStatus, remarks) => handleGateAdvance(gateNo, newStatus, remarks)}
                />
              ))}
            </div>
          )}

          {/* Documents tab */}
          {activeTab === "documents" && (
            <LinkedDocsSection
              contextType="project"
              contextId={project.id}
              canUpload={true}
              canDelete={true}
            />
          )}
        </div>

        {/* Right — Info sidebar */}
        <div className="space-y-4">
          {/* RAG / Blocker */}
          <RagPanel project={project} onUpdated={setProject} />

          {/* Key dates */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Key Dates</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Start Date</dt>
                <dd className="font-medium">{formatDate(project.startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Target COD</dt>
                <dd className="font-medium">{formatDate(project.targetCod)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Actual COD</dt>
                <dd className="font-medium">{formatDate(project.actualCod)}</dd>
              </div>
            </dl>
          </div>

          {/* Budget */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Budget</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Baseline (G1)</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(project.budgetBaseline)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Updated (G2)</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(project.budgetUpdated)}</dd>
              </div>
            </dl>
          </div>

          {/* Site */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Site</h3>
            <p className="text-sm font-medium">{project.site.name}</p>
            {project.site.address && (
              <p className="text-xs text-muted-foreground">{project.site.address}</p>
            )}
          </div>

          {/* Activity counters */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Activity</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "Issues",     count: project._count.issues,      warn: project._count.issues > 0 },
                { label: "Risks",      count: project._count.risks,       warn: false },
                { label: "Milestones", count: project._count.milestones,  warn: false },
                { label: "Variations", count: project._count.variations,  warn: project._count.variations > 0 },
                { label: "Punch Items",count: project._count.punchlistItems, warn: false },
              ].map(({ label, count, warn }) => (
                <div key={label} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`font-medium tabular-nums text-xs ${warn && count > 0 ? "text-orange-600" : ""}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {project.notes && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-sm mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
