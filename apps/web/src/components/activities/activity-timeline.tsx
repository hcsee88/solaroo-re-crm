"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Phone, Mail, MessageCircle, Users, MapPin, FileText, StickyNote, Check,
  Plus, X,
} from "lucide-react";
import { get, post } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

type ActivityType =
  | "CALL" | "EMAIL" | "WHATSAPP" | "MEETING" | "SITE_VISIT"
  | "PROPOSAL_FOLLOW_UP" | "GENERAL_NOTE"
  | "NOTE" | "TASK"; // legacy

export type ActivityItem = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
  ownerUserId: string;
  owner: { id: string; name: string };
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string | null } | null;
  site: { id: string; siteCode: string; name: string } | null;
  opportunity: { id: string; opportunityCode: string; title: string } | null;
};

const TYPE_META: Record<ActivityType, { label: string; Icon: React.ElementType; colour: string }> = {
  CALL:               { label: "Call",               Icon: Phone,         colour: "#0073ea" },
  EMAIL:              { label: "Email",              Icon: Mail,          colour: "#0073ea" },
  WHATSAPP:           { label: "WhatsApp",           Icon: MessageCircle, colour: "#00ca72" },
  MEETING:            { label: "Meeting",            Icon: Users,         colour: "#a25ddc" },
  SITE_VISIT:         { label: "Site Visit",         Icon: MapPin,        colour: "#fdab3d" },
  PROPOSAL_FOLLOW_UP: { label: "Proposal Follow-up", Icon: FileText,      colour: "#0073ea" },
  GENERAL_NOTE:       { label: "Note",               Icon: StickyNote,    colour: "#676879" },
  NOTE:               { label: "Note",               Icon: StickyNote,    colour: "#676879" },
  TASK:               { label: "Task",               Icon: Check,         colour: "#676879" },
};

const QUICK_ADD_TYPES: ActivityType[] = [
  "CALL", "EMAIL", "WHATSAPP", "MEETING", "SITE_VISIT", "PROPOSAL_FOLLOW_UP", "GENERAL_NOTE",
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Activity timeline — embed on opportunity / account / contact / site detail pages.
 * Pass exactly one anchor prop. Newest-first. Inline quick-add form.
 */
export function ActivityTimeline(props: {
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  siteId?: string;
  /** Hide quick-add (e.g. for read-only roles) */
  readOnly?: boolean;
}) {
  const [items, setItems]     = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "100", sortBy: "occurredAt", sortDir: "desc" });
      if (props.opportunityId) params.set("opportunityId", props.opportunityId);
      if (props.accountId)     params.set("accountId",     props.accountId);
      if (props.contactId)     params.set("contactId",     props.contactId);
      if (props.siteId)        params.set("siteId",        props.siteId);
      const r = await get<PaginatedResult<ActivityItem>>(`/activities?${params}`);
      setItems(r.items);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status !== 403) setError(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [props.opportunityId, props.accountId, props.contactId, props.siteId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>
          Activity timeline ({items.length})
        </h3>
        {!props.readOnly && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-xs font-medium inline-flex items-center gap-1"
            style={{ color: "#0073ea" }}
          >
            <Plus className="w-3.5 h-3.5" /> {showAdd ? "Cancel" : "Log activity"}
          </button>
        )}
      </div>

      {showAdd && !props.readOnly && (
        <QuickAddForm
          anchor={props}
          onCancel={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); refresh(); }}
        />
      )}

      {loading && <p className="text-sm" style={{ color: "#676879" }}>Loading…</p>}
      {error   && <p className="text-sm text-red-600">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm" style={{ color: "#676879" }}>No activities yet.</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.GENERAL_NOTE;
            return (
              <li key={a.id} className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: meta.colour + "15", color: meta.colour }}
                  title={meta.label}
                >
                  <meta.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: "#323338" }}>{a.subject}</p>
                    <span className="text-xs flex-shrink-0" style={{ color: "#a3a8b5" }}>{formatTime(a.occurredAt)}</span>
                  </div>
                  {a.body && (
                    <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: "#676879" }}>{a.body}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: "#a3a8b5" }}>
                    {meta.label} · {a.owner.name}
                    {a.opportunity && !props.opportunityId && ` · ${a.opportunity.opportunityCode}`}
                    {a.contact && !props.contactId && ` · ${a.contact.firstName}${a.contact.lastName ? " " + a.contact.lastName : ""}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Inline quick-add form ────────────────────────────────────────────────────

function QuickAddForm({
  anchor,
  onCancel,
  onCreated,
}: {
  anchor: { opportunityId?: string; accountId?: string; contactId?: string; siteId?: string };
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [type, setType]       = useState<ActivityType>("CALL");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [when, setWhen]       = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  async function submit() {
    if (!subject.trim()) { setErr("Subject required"); return; }
    setBusy(true);
    setErr(null);
    try {
      await post("/activities", {
        type,
        subject: subject.trim(),
        body:    body.trim() || undefined,
        occurredAt: new Date(when).toISOString(),
        opportunityId: anchor.opportunityId,
        accountId:     anchor.accountId,
        contactId:     anchor.contactId,
        siteId:        anchor.siteId,
      });
      onCreated();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
                  ?? (e as Error).message
                  ?? "Failed to log activity";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 p-3 rounded-md" style={{ background: "#f5f6f8", border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex flex-wrap gap-1 mb-2">
        {QUICK_ADD_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors"
              style={{
                background: active ? meta.colour + "20" : "#fff",
                color:      active ? meta.colour : "#676879",
                border:     `1px solid ${active ? meta.colour : "hsl(218 23% 91%)"}`,
              }}
            >
              <meta.Icon className="w-3 h-3" /> {meta.label}
            </button>
          );
        })}
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (e.g. 'Spoke with CFO about pricing')"
        className="w-full bg-white border rounded-md px-2 py-1.5 text-sm mb-2"
        style={{ borderColor: "hsl(218 23% 91%)" }}
      />
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-white border rounded-md px-2 py-1.5 text-sm mb-2"
        style={{ borderColor: "hsl(218 23% 91%)" }}
      />
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs" style={{ color: "#676879" }}>
          When:{" "}
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="bg-white border rounded px-1.5 py-1 text-xs ml-1"
            style={{ borderColor: "hsl(218 23% 91%)" }}
          />
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs px-2 py-1" style={{ color: "#676879" }}>
            <X className="w-3.5 h-3.5 inline" /> Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="text-xs font-medium text-white px-3 py-1 rounded-md disabled:opacity-50"
            style={{ background: "#0073ea" }}
          >
            {busy ? "Logging…" : "Log activity"}
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}
