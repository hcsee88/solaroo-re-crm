"use client";

import { useEffect, useState, useCallback } from "react";
import { Bookmark, Plus, Trash2, X } from "lucide-react";
import { get, post, del } from "@/lib/api-client";

type SavedView = {
  id: string;
  module: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
};

/**
 * SavedViewsBar — embed at the top of a list page.
 *
 * Usage:
 *   <SavedViewsBar
 *     module="contracts"
 *     currentFilters={{ status: statusFilter, handoverStatus: handoverFilter }}
 *     onApply={(filters) => { ... apply filters ... }}
 *   />
 */
export function SavedViewsBar({
  module,
  currentFilters,
  onApply,
}: {
  module: string;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const [views, setViews]     = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [name, setName]         = useState("");
  const [isDefault, setDefault] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await get<SavedView[]>(`/saved-views?module=${module}`);
      setViews(list);
      // Auto-apply default on first load
      const def = list.find((v) => v.isDefault);
      if (def && activeId === null) {
        onApply(def.filters);
        setActiveId(def.id);
      }
    } catch {
      // silent — saved views are a nice-to-have
    } finally {
      setLoading(false);
    }
  }, [module, activeId, onApply]);

  useEffect(() => { refresh(); }, [refresh]);

  async function applyView(v: SavedView) {
    setActiveId(v.id);
    onApply(v.filters);
  }

  async function saveCurrent() {
    if (!name.trim()) { setError("Name required"); return; }
    setBusy(true);
    setError(null);
    try {
      await post("/saved-views", {
        module,
        name: name.trim(),
        filters: currentFilters,
        isDefault,
      });
      setShowSave(false);
      setName("");
      setDefault(false);
      refresh();
    } catch (e) {
      setError((e as Error).message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: SavedView) {
    if (!confirm(`Delete saved view "${v.name}"?`)) return;
    try {
      await del(`/saved-views/${v.id}`);
      if (activeId === v.id) setActiveId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message ?? "Delete failed");
    }
  }

  if (loading) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Bookmark className="w-3.5 h-3.5" style={{ color: "#676879" }} />
      <span style={{ color: "#676879" }}>Views:</span>
      {views.length === 0 && (
        <span style={{ color: "#a3a8b5" }}>No saved views yet</span>
      )}
      {views.map((v) => {
        const active = activeId === v.id;
        return (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              background: active ? "#dce9fc" : "#f5f6f8",
              color:      active ? "#0073ea" : "#676879",
              border:     active ? "1px solid #0073ea" : "1px solid transparent",
            }}
          >
            <button onClick={() => applyView(v)} className="font-medium">
              {v.name}{v.isDefault ? " ★" : ""}
            </button>
            <button onClick={() => remove(v)} title="Delete" className="opacity-50 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}
      <button
        onClick={() => setShowSave((s) => !s)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
        style={{ background: "#f5f6f8", color: "#0073ea", border: "1px dashed #0073ea" }}
      >
        <Plus className="w-3 h-3" /> Save current
      </button>

      {showSave && (
        <div
          className="ml-2 inline-flex items-center gap-2 p-2 rounded-md"
          style={{ background: "#fff", border: "1px solid hsl(218 23% 91%)" }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            className="bg-white border rounded px-2 py-1 text-xs"
            style={{ borderColor: "hsl(218 23% 91%)", width: 180 }}
          />
          <label className="flex items-center gap-1 text-xs" style={{ color: "#676879" }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)} />
            Default
          </label>
          <button
            onClick={saveCurrent}
            disabled={busy}
            className="text-xs font-medium text-white px-2 py-1 rounded disabled:opacity-50"
            style={{ background: "#0073ea" }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setShowSave(false); setName(""); setError(null); }}
            className="text-xs"
            style={{ color: "#676879" }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
