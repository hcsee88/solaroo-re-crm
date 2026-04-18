"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Circle, Plus, Trash2, X } from "lucide-react";
import { get, post, patch, del } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Milestone = {
  id: string;
  contractId: string;
  milestoneNo: number;
  title: string;
  description: string | null;
  percentValue: string | null;
  amount: string | null;
  triggerCondition: string | null;
  targetDate: string | null;
  achievedDate: string | null;
  invoiceId: string | null;
  isAchieved: boolean;
};

function formatMoney(val: string | null, currency: string): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MilestonesPanel({
  contractId,
  currency,
  canEdit,
}: {
  contractId: string;
  currency: string;
  canEdit: boolean;
}) {
  const [items, setItems]       = useState<Milestone[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [busy, setBusy]         = useState<string | null>(null); // id being toggled

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await get<Milestone[]>(`/contracts/${contractId}/milestones`);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggleAchieved(m: Milestone) {
    setBusy(m.id);
    try {
      await patch(`/contracts/${contractId}/milestones/${m.id}`, { isAchieved: !m.isAchieved });
      await refresh();
    } catch (err) {
      setError((err as Error).message ?? "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: Milestone) {
    if (!confirm(`Delete milestone #${m.milestoneNo} "${m.title}"?`)) return;
    setBusy(m.id);
    try {
      await del(`/contracts/${contractId}/milestones/${m.id}`);
      await refresh();
    } catch (err) {
      setError((err as Error).message ?? "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>
          Milestones ({items.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-xs font-medium inline-flex items-center gap-1"
            style={{ color: "#0073ea" }}
          >
            <Plus className="w-3.5 h-3.5" /> {showAdd ? "Cancel" : "Add milestone"}
          </button>
        )}
      </div>

      {showAdd && canEdit && (
        <AddMilestoneForm
          contractId={contractId}
          currency={currency}
          onCancel={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); refresh(); }}
        />
      )}

      {loading && <p className="text-sm" style={{ color: "#676879" }}>Loading…</p>}
      {error   && <p className="text-sm text-red-600">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm" style={{ color: "#676879" }}>No milestones defined yet.</p>
      )}

      {!loading && items.length > 0 && (
        <table className="w-full text-sm">
          <thead style={{ color: "#a3a8b5" }}>
            <tr className="text-left text-xs">
              <th className="py-1.5 font-medium">#</th>
              <th className="py-1.5 font-medium">Milestone</th>
              <th className="py-1.5 font-medium">% / Amount</th>
              <th className="py-1.5 font-medium">Target</th>
              <th className="py-1.5 font-medium">Achieved</th>
              {canEdit && <th className="py-1.5 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const disabled = busy === m.id || !canEdit;
              return (
                <tr key={m.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                  <td className="py-2 pr-2 align-top" style={{ color: "#676879" }}>{m.milestoneNo}</td>
                  <td className="py-2 pr-2 align-top">
                    <div className="font-medium" style={{ color: m.isAchieved ? "#00854f" : "#323338" }}>{m.title}</div>
                    {m.triggerCondition && (
                      <div className="text-xs mt-0.5" style={{ color: "#676879" }}>{m.triggerCondition}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#323338" }}>
                    {m.percentValue ? `${m.percentValue}%` : "—"}
                    <div style={{ color: "#676879" }}>{formatMoney(m.amount, currency)}</div>
                  </td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#676879" }}>
                    {formatDate(m.targetDate)}
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <button
                      onClick={() => toggleAchieved(m)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                      style={{ color: m.isAchieved ? "#00854f" : "#676879" }}
                    >
                      {m.isAchieved ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      {m.isAchieved ? `Done · ${formatDate(m.achievedDate)}` : "Mark achieved"}
                    </button>
                  </td>
                  {canEdit && (
                    <td className="py-2 align-top text-right">
                      {!m.isAchieved && !m.invoiceId && (
                        <button
                          onClick={() => remove(m)}
                          disabled={disabled}
                          title="Delete"
                          className="opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "#a52840" }} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Add form (inline) ────────────────────────────────────────────────────────

function AddMilestoneForm({
  contractId,
  currency,
  onCancel,
  onCreated,
}: {
  contractId: string;
  currency: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [milestoneNo, setMilestoneNo]   = useState("1");
  const [title, setTitle]               = useState("");
  const [percentValue, setPercentValue] = useState("");
  const [amount, setAmount]             = useState("");
  const [triggerCondition, setTrigger]  = useState("");
  const [targetDate, setTargetDate]     = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [err, setErr]                   = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setErr("Title required"); return; }
    if (!milestoneNo || isNaN(+milestoneNo)) { setErr("Milestone # required"); return; }
    setSubmitting(true);
    setErr(null);
    try {
      await post(`/contracts/${contractId}/milestones`, {
        milestoneNo: +milestoneNo,
        title: title.trim(),
        percentValue: percentValue ? +percentValue : undefined,
        amount: amount ? +amount : undefined,
        triggerCondition: triggerCondition.trim() || undefined,
        targetDate: targetDate || undefined,
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message ?? "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inp = "w-full bg-white border rounded-md px-2 py-1 text-sm";
  const inpStyle = { borderColor: "hsl(218 23% 91%)" };

  return (
    <div className="mb-4 p-3 rounded-md" style={{ background: "#f5f6f8", border: "1px solid hsl(218 23% 91%)" }}>
      <div className="grid grid-cols-12 gap-2 mb-2">
        <input className={inp} style={{ ...inpStyle, gridColumn: "span 1" }} value={milestoneNo} onChange={(e) => setMilestoneNo(e.target.value)} placeholder="#" />
        <input className={inp + " col-span-5"} style={inpStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. 'On signing')" />
        <input className={inp + " col-span-2"} style={inpStyle} value={percentValue} onChange={(e) => setPercentValue(e.target.value)} placeholder="%" />
        <input className={inp + " col-span-2"} style={inpStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amt ${currency}`} />
        <input className={inp + " col-span-2"} style={inpStyle} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </div>
      <input className={inp} style={inpStyle} value={triggerCondition} onChange={(e) => setTrigger(e.target.value)} placeholder="Trigger condition (optional)" />
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-xs px-2 py-1" style={{ color: "#676879" }}>
          <X className="w-3.5 h-3.5 inline" /> Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="text-xs font-medium text-white px-3 py-1 rounded-md disabled:opacity-50"
          style={{ background: "#0073ea" }}
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
