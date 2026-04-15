"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { get, patch } from "@/lib/api-client";
import { CheckCircle2, Circle, Clock, XCircle, ChevronRight, AlertCircle } from "lucide-react";

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

// ─── Gate panel ───────────────────────────────────────────────────────────────

function GatePanel({
  gate,
  isCurrent,
  onDeliverableChange,
  onAdvanceGate,
}: {
  gate: Gate;
  isCurrent: boolean;
  onDeliverableChange: (gateNo: number, deliverableId: string, status: DeliverableStatus) => void;
  onAdvanceGate: (gateNo: number, newStatus: string) => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const done    = gate.deliverables.filter((d) => ["UPLOADED", "SUBMITTED", "APPROVED", "NOT_REQUIRED"].includes(d.status)).length;
  const required = gate.deliverables.filter((d) => d.isRequired).length;
  const requiredDone = gate.deliverables.filter((d) => d.isRequired && ["UPLOADED", "SUBMITTED", "APPROVED", "NOT_REQUIRED"].includes(d.status)).length;

  const gateStatusColour = GATE_STATUS_COLOURS[gate.status] ?? "text-muted-foreground";

  return (
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
          <div className="flex items-center gap-2">
            <span className="font-medium">G{gate.gateNo}: {gate.gateName}</span>
            {isCurrent && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Active</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
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

          {/* Gate actions */}
          {isCurrent && gate.status !== "APPROVED" && (
            <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
              {gate.status === "IN_PROGRESS" && (
                <button
                  onClick={() => onAdvanceGate(gate.gateNo, "SUBMITTED")}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Submit for Approval
                </button>
              )}
              {gate.status === "SUBMITTED" && (
                <>
                  <button
                    onClick={() => onAdvanceGate(gate.gateNo, "APPROVED")}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    Approve Gate
                  </button>
                  <button
                    onClick={() => onAdvanceGate(gate.gateNo, "REJECTED")}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {gate.status === "REJECTED" && (
                <button
                  onClick={() => onAdvanceGate(gate.gateNo, "IN_PROGRESS")}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Re-open Gate
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

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

  const handleGateAdvance = async (gateNo: number, newStatus: string) => {
    try {
      const updated = await patch<ProjectDetail>(
        `/projects/${params.id}/gates/${gateNo}/status`,
        { status: newStatus },
      );
      setProject(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update gate status");
    }
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
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Link href={`/accounts/${project.account.id}`} className="hover:text-primary hover:underline">
              {project.account.name}
            </Link>
            <span>·</span>
            <span>PM: {project.projectManager.name}</span>
            <span>·</span>
            <Link href={`/opportunities/${project.opportunity.id}`} className="hover:text-primary hover:underline">
              {project.opportunity.title}
            </Link>
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
        {/* Left — Gates */}
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
              isCurrent={gate.gateNo === project.currentGateNo}
              onDeliverableChange={handleDeliverableChange}
              onAdvanceGate={handleGateAdvance}
            />
          ))}
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
