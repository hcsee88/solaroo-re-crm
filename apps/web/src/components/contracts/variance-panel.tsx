"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { get } from "@/lib/api-client";

type Variance = {
  contractValue: number;
  invoicedTotal: number;
  paidTotal: number;
  outstanding: number;
  invoicedPercent: number;
  paidPercent: number;
  currency: string;
  invoiceCount: number;
};

function fmt(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Compact variance summary for a contract: contracted vs invoiced vs paid.
 * Uses the contract:view_value permission on the backend, so users without
 * commercial visibility get a 403 (we render nothing — silent fail).
 */
export function VariancePanel({ contractId }: { contractId: string }) {
  const [v, setV] = useState<Variance | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    get<Variance>(`/contracts/${contractId}/variance`)
      .then(setV)
      .catch((err) => {
        // 403 → silently hide (user lacks view_value permission)
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) setForbidden(true);
      })
      .finally(() => setLoading(false));
  }, [contractId]);

  if (forbidden) return null;
  if (loading)   return null;
  if (!v)        return null;

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#676879" }}>
        <TrendingUp className="w-3.5 h-3.5" /> Cash position
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Contracted" value={fmt(v.contractValue, v.currency)} colour="#323338" />
        <Stat
          label={`Invoiced (${v.invoiceCount})`}
          value={fmt(v.invoicedTotal, v.currency)}
          subValue={`${v.invoicedPercent}%`}
          colour="#0073ea"
        />
        <Stat
          label="Paid"
          value={fmt(v.paidTotal, v.currency)}
          subValue={`${v.paidPercent}%`}
          colour="#00854f"
        />
        <Stat
          label="Outstanding"
          value={fmt(v.outstanding, v.currency)}
          colour={v.outstanding > 0 ? "#a52840" : "#676879"}
        />
      </div>

      {/* Stacked progress bar: paid (green) | invoiced-but-unpaid (amber) | uninvoiced (gray) */}
      <div className="mt-3">
        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "hsl(218 23% 93%)" }}>
          <div style={{ width: `${Math.min(100, v.paidPercent)}%`, background: "#00ca72" }} />
          <div style={{ width: `${Math.min(100 - v.paidPercent, Math.max(0, v.invoicedPercent - v.paidPercent))}%`, background: "#fdab3d" }} />
        </div>
        <div className="flex items-center gap-3 text-xs mt-1.5" style={{ color: "#676879" }}>
          <Legend dot="#00ca72" label="Paid" />
          <Legend dot="#fdab3d" label="Invoiced unpaid" />
          <Legend dot="hsl(218 23% 93%)" label="Uninvoiced" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, subValue, colour }: { label: string; value: string; subValue?: string; colour: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "#676879" }}>{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: colour }}>{value}</div>
      {subValue && <div className="text-xs" style={{ color: "#a3a8b5" }}>{subValue}</div>}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}
