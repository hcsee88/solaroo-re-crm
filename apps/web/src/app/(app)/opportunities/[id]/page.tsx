"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get, post, patch } from "@/lib/api-client";
import type {
  OpportunityDetail,
  OpportunityStageValue,
} from "@solaroo/types";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_COLOURS,
  OPPORTUNITY_STAGE_ORDER,
  COMMERCIAL_MODEL_LABELS,
} from "@solaroo/types";
import { LinkedDocsSection } from "@/components/documents/linked-docs-section";
import { LinkedContractsSection } from "@/components/contracts/linked-contracts-section";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { NextActionPanel as StructuredNextActionPanel } from "@/components/opportunities/next-action-panel";
import { HealthBadge, type Health } from "@/components/opportunities/health-badge";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: OpportunityStageValue }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${OPPORTUNITY_STAGE_COLOURS[stage]}`}>
      {OPPORTUNITY_STAGE_LABELS[stage]}
    </span>
  );
}

function formatMYR(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `RM ${n.toLocaleString("en-MY")}`;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

const PIPELINE_STAGES = [...OPPORTUNITY_STAGE_ORDER];

function PipelineBar({ currentStage }: { currentStage: OpportunityStageValue }) {
  const idx = PIPELINE_STAGES.indexOf(currentStage as typeof PIPELINE_STAGES[number]);
  const isTerminal = currentStage === "WON" || currentStage === "LOST" || currentStage === "ON_HOLD";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1 overflow-x-auto">
        {PIPELINE_STAGES.map((stage, i) => {
          const isCurrent = stage === currentStage;
          const isDone = !isTerminal && idx > i;
          return (
            <div key={stage} className="flex items-center gap-1 flex-shrink-0">
              <div className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                isCurrent
                  ? OPPORTUNITY_STAGE_COLOURS[stage] + " ring-2 ring-offset-1 ring-primary"
                  : isDone
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {isCurrent && <span className="mr-1">●</span>}
                {OPPORTUNITY_STAGE_LABELS[stage]}
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <span className={`text-xs ${isDone || isCurrent ? "text-green-400" : "text-gray-300"}`}>›</span>
              )}
            </div>
          );
        })}
        {(currentStage === "LOST" || currentStage === "ON_HOLD") && (
          <div className={`rounded-full px-2.5 py-1 text-xs font-medium ml-2 ${OPPORTUNITY_STAGE_COLOURS[currentStage]}`}>
            ● {OPPORTUNITY_STAGE_LABELS[currentStage]}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage transition modal ───────────────────────────────────────────────────

type UserOption = { id: string; name: string; email: string };

function TransitionModal({
  opp,
  onClose,
  onSuccess,
}: {
  opp: OpportunityDetail;
  onClose: () => void;
  onSuccess: (updated: OpportunityDetail) => void;
}) {
  const [toStage, setToStage] = useState<OpportunityStageValue | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WON-specific project setup fields
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [budgetBaseline, setBudgetBaseline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetCod, setTargetCod] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const requiresReason = toStage === "LOST";
  const isWon = toStage === "WON";

  // Load users when WON is first selected
  useEffect(() => {
    if (isWon && users.length === 0) {
      setLoadingUsers(true);
      get<UserOption[]>("/admin/users/dropdown")
        .then((r) => setUsers(r))
        .catch(() => {})
        .finally(() => setLoadingUsers(false));
    }
  }, [isWon]);

  async function handleTransition() {
    if (!toStage) return;
    if (requiresReason && !reason.trim()) {
      setError("A reason is required when marking as Lost");
      return;
    }
    if (isWon) {
      if (!projectName.trim()) { setError("Project name is required"); return; }
      if (!projectCode.trim()) { setError("Project code is required (e.g. PT25-PROJ001)"); return; }
      if (!/^[A-Z]{2,5}\d{2}-[A-Z0-9]{2,10}$/.test(projectCode.trim())) {
        setError("Project code format: 2–5 uppercase letters + 2 digits + dash + 2–10 uppercase alphanumeric (e.g. PT25-PROJ001)");
        return;
      }
      if (!projectManagerId) { setError("Project manager is required"); return; }
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        toStage,
        reason: reason.trim() || undefined,
      };
      if (isWon) {
        body.projectName = projectName.trim();
        body.projectCode = projectCode.trim();
        body.projectManagerId = projectManagerId;
        if (budgetBaseline) body.budgetBaseline = parseFloat(budgetBaseline);
        if (startDate) body.startDate = startDate;
        if (targetCod) body.targetCod = targetCod;
      }
      const updated = await post<OpportunityDetail>(`/opportunities/${opp.id}/transition`, body);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Move Stage</h3>
          <p className="text-sm text-muted-foreground">
            Current: <StageBadge stage={opp.stage} />
          </p>

          <div>
            <label className="block text-sm font-medium mb-2">Move to</label>
            <div className="flex flex-wrap gap-2">
              {opp.allowedNextStages.map((s) => (
                <button
                  key={s}
                  onClick={() => { setToStage(s); setError(null); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                    toStage === s
                      ? OPPORTUNITY_STAGE_COLOURS[s] + " border-transparent ring-2 ring-primary ring-offset-1"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {OPPORTUNITY_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {toStage && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Reason / Notes {requiresReason && <span className="text-destructive">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={requiresReason ? "Why was this opportunity lost?" : "Optional context for this move…"}
                className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          )}

          {/* WON: project setup section */}
          {isWon && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">Project Setup</p>
              <p className="text-xs text-green-700">Marking as Won will automatically create a project record.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Project Name <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={`e.g. ${opp.account.name} Solar Project`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Project Code <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    placeholder="PT25-PROJ001"
                    className={inputCls + " font-mono"}
                  />
                  <p className="mt-0.5 text-xs text-muted-foreground">Format: XX25-XXXXXXX</p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Project Manager <span className="text-destructive">*</span></label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => setProjectManagerId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={loadingUsers}
                  >
                    <option value="">{loadingUsers ? "Loading…" : "— Select PM —"}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Budget Baseline (MYR)</label>
                  <input
                    type="number"
                    value={budgetBaseline}
                    onChange={(e) => setBudgetBaseline(e.target.value)}
                    placeholder="e.g. 850000"
                    min="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Target COD</label>
                  <input type="date" value={targetCod} onChange={(e) => setTargetCod(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleTransition}
              disabled={!toStage || submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Moving…" : isWon ? "Mark as Won & Create Project" : "Confirm Move"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Next Action inline panel ─────────────────────────────────────────────────

function NextActionPanel({
  opp,
  onUpdated,
}: {
  opp: OpportunityDetail;
  onUpdated: (updated: OpportunityDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nextAction, setNextAction] = useState(opp.nextAction ?? "");
  const [nextActionDueDate, setNextActionDueDate] = useState(
    opp.nextActionDueDate ? opp.nextActionDueDate.slice(0, 10) : ""
  );
  const [lastStatusNote, setLastStatusNote] = useState(opp.lastStatusNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOverdue =
    opp.nextActionDueDate &&
    new Date(opp.nextActionDueDate) < new Date() &&
    opp.stage !== "WON" &&
    opp.stage !== "LOST";

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patch<OpportunityDetail>(`/opportunities/${opp.id}`, {
        nextAction: nextAction.trim() || null,
        nextActionDueDate: nextActionDueDate ? new Date(nextActionDueDate).toISOString() : null,
        lastStatusNote: lastStatusNote.trim() || null,
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
    setNextAction(opp.nextAction ?? "");
    setNextActionDueDate(opp.nextActionDueDate ? opp.nextActionDueDate.slice(0, 10) : "");
    setLastStatusNote(opp.lastStatusNote ?? "");
    setSaveError(null);
    setEditing(false);
  }

  const inputCls = "w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  return (
    <div className={`rounded-lg border bg-card p-4 ${isOverdue ? "border-red-300 dark:border-red-700" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Next Action</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Send revised proposal to client"
              className={inputCls}
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
            <input
              type="date"
              value={nextActionDueDate}
              onChange={(e) => setNextActionDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Latest Status Note</label>
            <textarea
              value={lastStatusNote}
              onChange={(e) => setLastStatusNote(e.target.value)}
              placeholder="Brief status update for management visibility…"
              rows={2}
              maxLength={1000}
              className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none bg-background"
            />
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {opp.nextAction ? (
            <div>
              <p className="text-sm font-medium">{opp.nextAction}</p>
              {opp.nextActionDueDate && (
                <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                  {isOverdue ? "⚠ Overdue — " : "Due "}
                  {new Date(opp.nextActionDueDate).toLocaleDateString("en-MY", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No next action set.</p>
          )}
          {opp.lastStatusNote && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Latest Status</p>
              <p className="text-sm text-muted-foreground">{opp.lastStatusNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [opp, setOpp] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "documents">("overview");

  useEffect(() => {
    get<OpportunityDetail>(`/opportunities/${id}`)
      .then(setOpp)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load opportunity"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-64 rounded bg-muted" /><div className="h-4 w-40 rounded bg-muted" /></div>;
  }

  if (error || !opp) {
    return <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error ?? "Opportunity not found"}</div>;
  }

  const canTransition = opp.allowedNextStages.length > 0;

  return (
    <div className="space-y-6">
      {showTransition && opp && (
        <TransitionModal opp={opp} onClose={() => setShowTransition(false)} onSuccess={setOpp} />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/opportunities" className="hover:text-foreground">Opportunities</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-xs">{opp.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{opp.title}</h1>
            <StageBadge stage={opp.stage} />
            {opp.health && <HealthBadge health={opp.health as Health} size="md" />}
          </div>
          <p className="text-sm font-mono text-muted-foreground">{opp.opportunityCode}</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href={`/accounts/${opp.account.id}`} className="hover:text-primary hover:underline">{opp.account.name}</Link>
            <span>·</span>
            <Link href={`/sites/${opp.site.id}`} className="hover:text-primary hover:underline">{opp.site.name}</Link>
          </div>
        </div>
        <div className="flex gap-2">
          {canTransition && (
            <button
              onClick={() => setShowTransition(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Move Stage →
            </button>
          )}
          <Link href={`/opportunities/${id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Edit
          </Link>
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar currentStage={opp.stage} />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Est. Value</p>
          <p className="text-lg font-semibold mt-0.5 tabular-nums">{formatMYR(opp.estimatedValue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Probability</p>
          <p className="text-lg font-semibold mt-0.5">{opp.probabilityPercent != null ? `${opp.probabilityPercent}%` : "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Solar PV</p>
          <p className="text-lg font-semibold mt-0.5">{opp.estimatedPvKwp ? `${opp.estimatedPvKwp} kWp` : "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">BESS</p>
          <p className="text-lg font-semibold mt-0.5">
            {opp.estimatedBessKwh ? `${opp.estimatedBessKwh} kWh` : "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          {[
            { key: "overview", label: "Overview" },
            { key: "history", label: `Stage History (${opp.stageHistory.length})` },
            { key: "documents", label: "Documents" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "overview" | "history" | "documents")}
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

      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Next Action panel — spans full width, shown prominently */}
          <div className="md:col-span-2">
            <StructuredNextActionPanel
              opp={{
                id: opp.id,
                ownerUserId: opp.owner.id,
                nextAction: opp.nextAction,
                nextActionType: opp.nextActionType,
                nextActionDueDate: opp.nextActionDueDate,
                nextActionOwnerId: opp.nextActionOwnerId,
                nextActionStatus: opp.nextActionStatus,
                effectiveNextActionStatus: opp.effectiveNextActionStatus,
              }}
              onUpdated={(u) => setOpp({ ...opp, ...u } as OpportunityDetail)}
            />

            {/* Activity timeline — manual sales touchpoints */}
            <div className="md:col-span-2">
              <ActivityTimeline opportunityId={opp.id} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Commercial Details</h3>
            <dl className="space-y-3">
              <Field label="Commercial Model" value={opp.commercialModel ? COMMERCIAL_MODEL_LABELS[opp.commercialModel] : null} />
              <Field label="Estimated Value" value={formatMYR(opp.estimatedValue)} />
              <Field label="Expected Award" value={opp.expectedAwardDate ? new Date(opp.expectedAwardDate).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" }) : null} />
              <Field label="Owner (Sales)"   value={opp.owner.name} />
              <Field label="Design Engineer" value={opp.designEngineer?.name ?? null} />
              {opp.lostReason && <Field label="Lost Reason" value={opp.lostReason} />}
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Technical Scope</h3>
            <dl className="space-y-3">
              <Field label="Solar PV" value={opp.estimatedPvKwp ? `${opp.estimatedPvKwp} kWp` : null} />
              <Field label="BESS Power" value={opp.estimatedBessKw ? `${opp.estimatedBessKw} kW` : null} />
              <Field label="BESS Energy" value={opp.estimatedBessKwh ? `${opp.estimatedBessKwh} kWh` : null} />
              <Field label="Grid Category" value={opp.site.gridCategory.replace(/_/g, " ")} />
            </dl>
          </div>

          {opp.summary && (
            <div className="md:col-span-2 rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">Summary</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{opp.summary}</p>
            </div>
          )}

          {/* Linked contracts — bridge from won/awarded sales work to project execution */}
          <div className="md:col-span-2">
            <LinkedContractsSection opportunityId={opp.id} />
          </div>


          {(opp.risks || opp.competitors) && (
            <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
              {opp.risks && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-2">Key Risks</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{opp.risks}</p>
                </div>
              )}
              {opp.competitors && (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-2">Competitors</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{opp.competitors}</p>
                </div>
              )}
            </div>
          )}

          <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>Created {new Date(opp.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span>Last updated {new Date(opp.updatedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">Stage History</h3>
          </div>
          {opp.stageHistory.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No stage history yet.</p>
          ) : (
            <ul className="divide-y">
              {opp.stageHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.fromStage && (
                        <>
                          <StageBadge stage={h.fromStage} />
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <StageBadge stage={h.toStage} />
                    </div>
                    {h.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{h.reason}</p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(h.changedAt).toLocaleDateString("en-MY", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Documents tab ────────────────────────────────────────────────────── */}
      {activeTab === "documents" && (
        <LinkedDocsSection
          contextType="opportunity"
          contextId={id}
          canUpload={true}
          canDelete={true}
        />
      )}
    </div>
  );
}
