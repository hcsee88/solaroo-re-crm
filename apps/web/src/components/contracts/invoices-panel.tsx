"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { get, post, patch } from "@/lib/api-client";
import type { Milestone } from "./milestones-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus =
  | "NOT_RAISED"
  | "RAISED"
  | "SUBMITTED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "DISPUTED";

type Invoice = {
  id: string;
  invoiceNo: string;
  contractId: string;
  milestoneId: string | null;
  amount: string;
  taxAmount: string | null;
  totalAmount: string;
  currency: string;
  status: InvoiceStatus;
  invoiceDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: string | null;
  notes: string | null;
};

const STATUS_COLOURS: Record<InvoiceStatus, string> = {
  NOT_RAISED:     "bg-gray-100 text-gray-700",
  RAISED:         "bg-blue-100 text-blue-700",
  SUBMITTED:      "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID:           "bg-green-100 text-green-700",
  DISPUTED:       "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  NOT_RAISED:     "Not Raised",
  RAISED:         "Raised",
  SUBMITTED:      "Submitted",
  PARTIALLY_PAID: "Partially Paid",
  PAID:           "Paid",
  DISPUTED:       "Disputed",
};

const ALL_STATUSES: InvoiceStatus[] = [
  "NOT_RAISED", "RAISED", "SUBMITTED", "PARTIALLY_PAID", "PAID", "DISPUTED",
];

function formatMoney(val: string | null, currency: string): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicesPanel({
  contractId,
  currency,
  canEdit,
}: {
  contractId: string;
  currency: string;
  canEdit: boolean;
}) {
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [busy, setBusy]             = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, ms] = await Promise.all([
        get<Invoice[]>(`/contracts/${contractId}/invoices`),
        get<Milestone[]>(`/contracts/${contractId}/milestones`),
      ]);
      setInvoices(inv);
      setMilestones(ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function setStatus(inv: Invoice, status: InvoiceStatus) {
    setBusy(inv.id);
    try {
      const body: Record<string, unknown> = { status };
      // For PAID, default paidAmount to totalAmount if not already set
      if (status === "PAID" && !inv.paidAmount) {
        body.paidAmount = +inv.totalAmount;
      }
      await patch(`/contracts/${contractId}/invoices/${inv.id}/status`, body);
      await refresh();
    } catch (err) {
      setError((err as Error).message ?? "Status update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: "1px solid hsl(218 23% 91%)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>
          Invoices ({invoices.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-xs font-medium inline-flex items-center gap-1"
            style={{ color: "#0073ea" }}
          >
            <Plus className="w-3.5 h-3.5" /> {showAdd ? "Cancel" : "Add invoice"}
          </button>
        )}
      </div>

      {showAdd && canEdit && (
        <AddInvoiceForm
          contractId={contractId}
          currency={currency}
          milestones={milestones.filter((m) => !m.invoiceId)}
          onCancel={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); refresh(); }}
        />
      )}

      {loading && <p className="text-sm" style={{ color: "#676879" }}>Loading…</p>}
      {error   && <p className="text-sm text-red-600">{error}</p>}

      {!loading && invoices.length === 0 && (
        <p className="text-sm" style={{ color: "#676879" }}>No invoices yet.</p>
      )}

      {!loading && invoices.length > 0 && (
        <table className="w-full text-sm">
          <thead style={{ color: "#a3a8b5" }}>
            <tr className="text-left text-xs">
              <th className="py-1.5 font-medium">Invoice #</th>
              <th className="py-1.5 font-medium">Milestone</th>
              <th className="py-1.5 font-medium text-right">Amount</th>
              <th className="py-1.5 font-medium">Invoice date</th>
              <th className="py-1.5 font-medium">Due</th>
              <th className="py-1.5 font-medium">Paid</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const linkedMs = inv.milestoneId ? milestones.find((m) => m.id === inv.milestoneId) : null;
              return (
                <tr key={inv.id} className="border-t" style={{ borderColor: "hsl(218 23% 93%)" }}>
                  <td className="py-2 pr-2 align-top font-medium" style={{ color: "#323338" }}>{inv.invoiceNo}</td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#676879" }}>
                    {linkedMs ? `#${linkedMs.milestoneNo} ${linkedMs.title}` : "—"}
                  </td>
                  <td className="py-2 pr-2 align-top text-right" style={{ color: "#323338" }}>
                    {formatMoney(inv.totalAmount, inv.currency)}
                  </td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#676879" }}>{formatDate(inv.invoiceDate)}</td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#676879" }}>{formatDate(inv.dueDate)}</td>
                  <td className="py-2 pr-2 align-top text-xs" style={{ color: "#676879" }}>
                    {inv.paidDate ? formatDate(inv.paidDate) : "—"}
                    {inv.paidAmount && (
                      <div className="text-xs" style={{ color: "#00854f" }}>
                        {formatMoney(inv.paidAmount, inv.currency)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 align-top">
                    {canEdit ? (
                      <select
                        value={inv.status}
                        onChange={(e) => setStatus(inv, e.target.value as InvoiceStatus)}
                        disabled={busy === inv.id}
                        className={`text-xs font-medium rounded-full px-2 py-0.5 cursor-pointer ${STATUS_COLOURS[inv.status]} disabled:opacity-50`}
                        style={{ border: "none" }}
                      >
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Add form ────────────────────────────────────────────────────────────────

function AddInvoiceForm({
  contractId,
  currency,
  milestones,
  onCancel,
  onCreated,
}: {
  contractId: string;
  currency: string;
  milestones: Milestone[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [invoiceNo, setInvoiceNo]     = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [amount, setAmount]           = useState("");
  const [tax, setTax]                 = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate]         = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  async function submit() {
    if (!invoiceNo.trim()) { setErr("Invoice # required"); return; }
    if (!amount || isNaN(+amount)) { setErr("Amount required"); return; }
    setSubmitting(true);
    setErr(null);
    try {
      const amt = +amount;
      const taxAmt = tax ? +tax : 0;
      await post(`/contracts/${contractId}/invoices`, {
        invoiceNo: invoiceNo.trim(),
        milestoneId: milestoneId || undefined,
        amount: amt,
        taxAmount: tax ? taxAmt : undefined,
        totalAmount: amt + taxAmt,
        currency,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
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
        <input className={inp + " col-span-3"} style={inpStyle} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Invoice #" />
        <select className={inp + " col-span-4"} style={inpStyle} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
          <option value="">No milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>#{m.milestoneNo} {m.title}</option>
          ))}
        </select>
        <input className={inp + " col-span-2"} style={inpStyle} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <input className={inp + " col-span-2"} style={inpStyle} type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Tax" />
        <span className="col-span-1 text-xs flex items-center" style={{ color: "#676879" }}>{currency}</span>
      </div>
      <div className="grid grid-cols-12 gap-2 mb-2">
        <input className={inp + " col-span-3"} style={inpStyle} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} placeholder="Invoice date" />
        <input className={inp + " col-span-3"} style={inpStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="Due date" />
      </div>
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
