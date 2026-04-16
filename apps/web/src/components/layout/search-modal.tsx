"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Building2,
  User,
  MapPin,
  TrendingUp,
  FileText,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { get } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = "account" | "contact" | "site" | "opportunity" | "proposal" | "project";

type SearchResultItem = {
  id: string;
  type: ResultType;
  code: string | null;
  title: string;
  subtitle: string | null;
  url: string;
};

type ResultGroup = {
  type: ResultType;
  label: string;
  items: SearchResultItem[];
};

type SearchResponse = {
  query: string;
  total: number;
  groups: ResultGroup[];
};

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  account:     <Building2 className="w-3.5 h-3.5" />,
  contact:     <User className="w-3.5 h-3.5" />,
  site:        <MapPin className="w-3.5 h-3.5" />,
  opportunity: <TrendingUp className="w-3.5 h-3.5" />,
  proposal:    <FileText className="w-3.5 h-3.5" />,
  project:     <FolderKanban className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<ResultType, string> = {
  account:     "#0073ea",
  contact:     "#a25ddc",
  site:        "#00ca72",
  opportunity: "#fdab3d",
  proposal:    "#579bfc",
  project:     "#e2445c",
};

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── SearchModal ──────────────────────────────────────────────────────────────

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 280);

  // ── Auto-focus on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setQuery("");
      setResults(null);
      setError(null);
      setActiveIndex(-1);
    }
  }, [open]);

  // ── Fetch results ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    get<SearchResponse>(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setActiveIndex(-1);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, open]);

  // ── Flatten items for keyboard navigation ───────────────────────────────────
  const flatItems: SearchResultItem[] = results?.groups.flatMap((g) => g.items) ?? [];

  // ── Navigate to result ──────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (item: SearchResultItem) => {
      onClose();
      router.push(item.url);
    },
    [router, onClose],
  );

  // ── Keyboard: Escape closes; ↑↓ navigates; Enter selects ───────────────────
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) navigateTo(item);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, flatItems, activeIndex, navigateTo]);

  if (!open) return null;

  const showEmpty =
    !loading && !error && debouncedQuery.trim().length >= 2 && results && results.total === 0;
  const showPrompt =
    !loading && !error && debouncedQuery.trim().length < 2 && query.length === 0;

  // ── Build flat item index map for key navigation ────────────────────────────
  let globalIdx = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(26,26,67,0.35)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(26,26,67,0.28)", background: "#fff" }}
      >
        {/* Search input row */}
        <div
          className="flex items-center gap-3 px-4 h-14"
          style={{ borderBottom: "1px solid hsl(218 23% 91%)" }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "#0073ea" }} />
          ) : (
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#676879" }} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search opportunities, projects, proposals, accounts…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#676879]"
            style={{ color: "#323338" }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults(null); }}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: "hsl(218 23% 91%)", color: "#676879" }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <kbd
            onClick={onClose}
            className="cursor-pointer text-xs font-mono rounded px-1.5 py-0.5 flex-shrink-0"
            style={{ background: "hsl(218 23% 91%)", color: "#676879", fontSize: "10px" }}
          >
            Esc
          </kbd>
        </div>

        {/* Results body */}
        <div className="overflow-y-auto" style={{ maxHeight: "min(480px, 60vh)" }}>
          {/* Prompt */}
          {showPrompt && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Search className="w-8 h-8" style={{ color: "hsl(218 23% 88%)" }} />
              <p className="text-sm" style={{ color: "#676879" }}>
                Type at least 2 characters to search
              </p>
            </div>
          )}

          {/* Typing but < 2 chars */}
          {!showPrompt && query.length > 0 && query.length < 2 && !loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm" style={{ color: "#676879" }}>Keep typing…</p>
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Search className="w-8 h-8" style={{ color: "hsl(218 23% 88%)" }} />
              <p className="text-sm font-medium" style={{ color: "#323338" }}>
                No results for &ldquo;{debouncedQuery}&rdquo;
              </p>
              <p className="text-xs" style={{ color: "#676879" }}>
                Try a different keyword or record code
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Result groups */}
          {results && results.total > 0 &&
            results.groups.map((group) => (
              <div key={group.type}>
                {/* Group header */}
                <div
                  className="flex items-center gap-2 px-4 pt-4 pb-1.5"
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "#676879" }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="text-[10px] font-mono rounded-full px-1.5 py-0.5"
                    style={{ background: "hsl(218 23% 94%)", color: "#676879" }}
                  >
                    {group.items.length}
                  </span>
                </div>

                {/* Group items */}
                {group.items.map((item) => {
                  const myIdx = globalIdx++;
                  const isActive = myIdx === activeIndex;
                  const iconColor = TYPE_COLOR[item.type] ?? "#0073ea";

                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item)}
                      onMouseEnter={() => setActiveIndex(myIdx)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{
                        background: isActive ? "hsl(213 100% 97%)" : "transparent",
                        borderLeft: isActive ? `3px solid ${iconColor}` : "3px solid transparent",
                      }}
                    >
                      {/* Type icon bubble */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${iconColor}18`, color: iconColor }}
                      >
                        {TYPE_ICON[item.type]}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium truncate" style={{ color: "#323338" }}>
                            {item.title}
                          </span>
                          {item.code && (
                            <span className="text-xs flex-shrink-0" style={{ color: "#676879" }}>
                              {item.code}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-xs truncate mt-0.5" style={{ color: "#676879" }}>
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Arrow hint on hover */}
                      {isActive && (
                        <span className="text-xs flex-shrink-0" style={{ color: iconColor }}>
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>

        {/* Footer */}
        {results && results.total > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: "1px solid hsl(218 23% 91%)" }}
          >
            <p className="text-xs" style={{ color: "#676879" }}>
              {results.total} result{results.total !== 1 ? "s" : ""} — showing top {MAX_LABEL} per category
            </p>
            <div className="flex items-center gap-3 text-xs" style={{ color: "#676879" }}>
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const MAX_LABEL = 5;
