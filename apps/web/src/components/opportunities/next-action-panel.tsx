"use client";

import { useEffect, useState } from "react";
import { Target, CheckCircle2, AlertCircle, Edit3, X } from "lucide-react";
import { get, patch } from "@/lib/api-client";

// CANCELLED added in Sales Pipeline Lite (2026-05-08) — UI treats it like NONE
// (no badge, no due-date emphasis), but keeping it in the union here for type
// compatibility with the shared EffectiveNextActionStatus type.
type EffectiveStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "OVERDUE" | "NONE";

type NextActionType =
  | "FOLLOW_UP" | "SITE_SURVEY" | "REVISED_QUOTATION"
  | "CLIENT_MEETING" | "INTERNAL_REVIEW" | "OTHER";

const TYPE_LABELS: Record<NextActionType, string> = {
  FOLLOW_UP:         "Follow Up",
  SITE_SURVEY:       "Site Survey",
  REVISED_QUOTATION: "Revised Quotation",
  CLIENT_MEETING:    "Client Meeting",
  INTERNAL_REVIEW:   "Internal Review",
  OTHER:             "Other",
};

type Opp = {
  id: string;
  ownerUserId: string;
  nextAction: string | null;
  nextActionType: NextActionType | null;
  nextActionDueDate: string | null;
  nextActionOwnerId: string | null;
  nextActionStatus: "PENDING" | "COMPLETED";
  effectiveNextActionStatus: EffectiveStatus;
  nextActionOwner?: { id: string; name: string } | null;
};

type UserOption = { id: string; name: string; roleName: string };

export function NextActionPanel({
  opp,
  onUpdated,
}: {
  opp: Opp;
  onUpdated: (updated: Opp) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [users, setUsers]     = useState<UserOption[]>([]);

  // Form state
  const [text, setText]   = useState(opp.nextAction ?? "");
  const [type, setType]   = useState<NextActionType | "">(opp.nextActionType ?? "");
  const [due, setDue]     = useState<string>(opp.nextActionDueDate ? opp.nextActionDueDate.slice(0, 10) : "");
  const [owner, setOwner] = useState<string>(opp.nextActionOwnerId ?? opp.ownerUserId);

  useEffect(() => {
    get<UserOption[]>("/admin/users/dropdown").then(setUsers).catch(() => {});
  }, []);

  // Re-sync form when opp prop changes
  useEffect(() => {
    setText(opp.nextAction ?? "");
    setType(opp.nextActionType ?? "");
    setDue(opp.nextActionDueDate ? opp.nextActionDueDate.slice(0, 10) : "");
    setOwner(opp.nextActionOwnerId ?? opp.ownerUserId);
  }, [opp]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const updated = await patch<Opp>(`/opportunities/${opp.id}/next-action`, {
        nextAction: text.trim() || undefined,
        nextActionType: type || undefined,
        nextActionDueDate: due || null,
        nextActionOwnerId: owner || null,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function markComplete() {
    setBusy(true);
    setErr(null);
    try {
      const updated = await patch<Opp>(`/opportunities/${opp.id}/next-action`, { nextActionStatus: "COMPLETED" });
      onUpdated(updated);
    } catch (e) {
      setErr((e as Error).message ?? "Failed to mark complete");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setErr(null);
    try {
      const updated = await patch<Opp>(`/opportunities/${opp.id}/next-action`, { nextActionStatus: "PENDING" });
      onUpdated(updated);
    } catch (e) {
      setErr((e as Error).message ?? "Failed to reopen");
    } finally {
      setBusy(false);
    }
  }

  const status = opp.effectiveNextActionStatus;
  const statusMeta = (() => {
    switch (status) {
      case "OVERDUE":   return { label: "Overdue",   bg: "hsl(354 70% 92%)", fg: "#a52840", Icon: AlertCircle };
      case "PENDING":   return { label: "Pending",   bg: "hsl(213 100% 95%)", fg: "#0073ea", Icon: Target };
      case "COMPLETED": return { label: "Completed", bg: "hsl(146 65% 92%)", fg: "#00854f", Icon: CheckCircle2 };
      case "CANCELLED": return { label: "Cancelled", bg: "hsl(218 23% 93%)", fg: "#676879", Icon: X };
      case "NONE":      return { label: "Not set",   bg: "hsl(218 23% 93%)", fg: "#676879", Icon: Target };
      default:          return { label: "Not set",   bg: "hsl(218 23% 93%)", fg: "#676879", Icon: Target };
    }
  })();

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "#676879" }}>
          <Target className="w-3.5 h-3.5" /> Next action
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: statusMeta.bg, color: statusMeta.fg }}
        >
          <statusMeta.Icon className="w-3 h-3" /> {statusMeta.label}
        </span>
      </div>

      {!editing && (
        <div className="space-y-2">
          {opp.nextAction ? (
            <>
              <div className="text-sm" style={{ color: "#323338" }}>{opp.nextAction}</div>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#676879" }}>
                <div>Type: <span style={{ color: "#323338" }}>{opp.nextActionType ? TYPE_LABELS[opp.nextActionType] : "—"}</span></div>
                <div>Due: <span style={{ color: opp.effectiveNextActionStatus === "OVERDUE" ? "#a52840" : "#323338" }}>
                  {opp.nextActionDueDate ? new Date(opp.nextActionDueDate).toLocaleDateString("en-MY", { dateStyle: "medium" }) : "—"}
                </span></div>
                <div>Owner: <span style={{ color: "#323338" }}>{opp.nextActionOwner?.name ?? "—"}</span></div>
              </div>
            </>
          ) : (
            <p className="text-sm italic" style={{ color: "#a3a8b5" }}>No next action set. Add one to keep this deal moving.</p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="text-xs font-medium inline-flex items-center gap-1 rounded-md border px-2.5 py-1"
              style={{ borderColor: "hsl(218 23% 91%)", color: "#676879", background: "#fff" }}
            >
              <Edit3 className="w-3 h-3" /> {opp.nextAction ? "Edit" : "Set next action"}
            </button>
            {(status === "PENDING" || status === "OVERDUE") && (
              <button
                onClick={markComplete}
                disabled={busy}
                className="text-xs font-medium text-white px-2.5 py-1 rounded-md disabled:opacity-50"
                style={{ background: "#00ca72" }}
              >
                Mark complete
              </button>
            )}
            {status === "COMPLETED" && (
              <button
                onClick={reopen}
                disabled={busy}
                className="text-xs font-medium px-2.5 py-1 rounded-md border"
                style={{ borderColor: "hsl(218 23% 91%)", color: "#676879" }}
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to happen next?"
            className="w-full bg-white border rounded-md px-2 py-1.5 text-sm"
            style={{ borderColor: "hsl(218 23% 91%)" }}
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NextActionType | "")}
              className="bg-white border rounded-md px-2 py-1.5 text-sm"
              style={{ borderColor: "hsl(218 23% 91%)" }}
            >
              <option value="">— Type —</option>
              {(Object.keys(TYPE_LABELS) as NextActionType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="bg-white border rounded-md px-2 py-1.5 text-sm"
              style={{ borderColor: "hsl(218 23% 91%)" }}
            />
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="bg-white border rounded-md px-2 py-1.5 text-sm"
              style={{ borderColor: "hsl(218 23% 91%)" }}
            >
              <option value="">— Owner —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setEditing(false); setErr(null); }}
              className="text-xs px-2 py-1"
              style={{ color: "#676879" }}
            >
              <X className="w-3.5 h-3.5 inline" /> Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="text-xs font-medium text-white px-3 py-1 rounded-md disabled:opacity-50"
              style={{ background: "#0073ea" }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
