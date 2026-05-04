import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";

export type Health = "HEALTHY" | "AT_RISK" | "STALE" | "OVERDUE";

const STYLES: Record<Health, { bg: string; fg: string; label: string; Icon: React.ElementType }> = {
  HEALTHY:  { bg: "hsl(146 65% 92%)",   fg: "#00854f", label: "Healthy",  Icon: CheckCircle2 },
  AT_RISK:  { bg: "hsl(43 96% 92%)",    fg: "#b45309", label: "At Risk",  Icon: AlertTriangle },
  STALE:    { bg: "hsl(218 23% 93%)",   fg: "#676879", label: "Stale",    Icon: Clock },
  OVERDUE:  { bg: "hsl(354 70% 92%)",   fg: "#a52840", label: "Overdue",  Icon: AlertCircle },
};

export function HealthBadge({ health, size = "sm" }: { health: Health; size?: "sm" | "md" }) {
  const s = STYLES[health];
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
