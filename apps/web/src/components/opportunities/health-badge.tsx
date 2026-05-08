import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

// Sales Pipeline Lite (2026-05-08): 3-state health.
// AT_RISK was removed — see docs/opportunity-health-rules.md.
// Tone: "Needs follow-up" instead of "Stale" so the label encourages action
// rather than feeling like a verdict.
export type Health = "HEALTHY" | "STALE" | "OVERDUE";

const STYLES: Record<Health, { bg: string; fg: string; label: string; Icon: React.ElementType }> = {
  HEALTHY: { bg: "hsl(146 65% 92%)", fg: "#00854f", label: "Healthy",          Icon: CheckCircle2 },
  STALE:   { bg: "hsl(43 96% 92%)",  fg: "#b45309", label: "Needs follow-up",  Icon: Clock },
  OVERDUE: { bg: "hsl(354 70% 92%)", fg: "#a52840", label: "Overdue",          Icon: AlertCircle },
};

// Backwards-compatibility shim: any rows still tagged AT_RISK from the worker
// or stale page caches are rendered as STALE so the UI never crashes during the
// rolling deploy. Remove this map after a couple of days when caches expire.
const LEGACY_REMAP: Record<string, Health> = {
  AT_RISK: "STALE",
};

export function HealthBadge({ health, size = "sm" }: { health: Health | string; size?: "sm" | "md" }) {
  const normalised: Health = (LEGACY_REMAP[health as string] ?? (health as Health)) as Health;
  const s = STYLES[normalised] ?? STYLES.HEALTHY;
  const padding = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const text    = size === "md" ? "text-xs"    : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${text}`}
      style={{ background: s.bg, color: s.fg }}
      title={s.label}
    >
      <s.Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}
