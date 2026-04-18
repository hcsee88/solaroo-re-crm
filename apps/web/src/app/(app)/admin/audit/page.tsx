"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { get } from "@/lib/api-client";
import { AuditTrail } from "@/components/audit/audit-trail";

const RESOURCE_OPTIONS = [
  { value: "",                   label: "All resources" },
  { value: "contract",           label: "Contracts" },
  { value: "opportunity",        label: "Opportunities" },
  { value: "project",            label: "Projects" },
  { value: "project_gate",       label: "Project gates" },
  { value: "gate_deliverable",   label: "Gate deliverables" },
  { value: "purchase_order",     label: "Purchase orders" },
  { value: "document_revision",  label: "Document revisions" },
  { value: "invoice",            label: "Invoices" },
];

type UserOption = { id: string; name: string; email: string; roleName: string };

export default function AdminAuditPage() {
  const [resource, setResource]     = useState<string>("");
  const [resourceId, setResourceId] = useState<string>("");
  const [userId, setUserId]         = useState<string>("");
  const [from, setFrom]             = useState<string>("");
  const [to, setTo]                 = useState<string>("");

  // Applied (committed) filter values — only these flow into the AuditTrail
  const [applied, setApplied] = useState<{
    resource: string; resourceId: string; userId: string; from: string; to: string;
  }>({ resource: "", resourceId: "", userId: "", from: "", to: "" });

  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    get<UserOption[]>("/admin/users/dropdown")
      .then(setUsers)
      .catch(() => {});
  }, []);

  function apply() {
    setApplied({
      resource,
      resourceId: resourceId.trim(),
      userId,
      // Date inputs come back as yyyy-mm-dd; treat 'to' as end-of-day
      from: from || "",
      to:   to ? `${to}T23:59:59.999` : "",
    });
  }

  function reset() {
    setResource(""); setResourceId(""); setUserId(""); setFrom(""); setTo("");
    setApplied({ resource: "", resourceId: "", userId: "", from: "", to: "" });
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <History className="w-6 h-6" style={{ color: "#676879" }} />
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>Audit log</h1>
          <p className="text-sm mt-1" style={{ color: "#676879" }}>
            Governance trail across all modules. Filter by resource type, record ID, user, or date range.
          </p>
        </div>
      </div>

      <div
        className="rounded-xl bg-white p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
        style={{ border: "1px solid hsl(218 23% 91%)" }}
      >
        <Field label="Resource type" colSpan={3}>
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className="input"
          >
            {RESOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Record ID (optional)" colSpan={4}>
          <input
            type="text"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder="e.g. cmnu3ce62…"
            className="input font-mono"
          />
        </Field>

        <Field label="User" colSpan={3}>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="input">
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>

        <Field label="From" colSpan={1}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </Field>
        <Field label="To" colSpan={1}>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </Field>

        <div className="md:col-span-12 flex items-center justify-end gap-2 pt-1">
          <button
            onClick={reset}
            className="text-sm px-3 py-1.5 rounded-md border"
            style={{ borderColor: "hsl(218 23% 91%)", color: "#676879", background: "#fff" }}
          >
            Reset
          </button>
          <button
            onClick={apply}
            className="text-sm font-medium text-white px-4 py-1.5 rounded-md"
            style={{ background: "#0073ea" }}
          >
            Apply
          </button>
        </div>
      </div>

      <AuditTrail
        resource={applied.resource || undefined}
        resourceId={applied.resourceId || undefined}
        userId={applied.userId || undefined}
        from={applied.from || undefined}
        to={applied.to || undefined}
        pageSize={50}
        showResource
      />

      <style jsx>{`
        .input {
          width: 100%;
          background: #fff;
          border: 1px solid hsl(218 23% 91%);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 14px;
          color: #323338;
          outline: none;
        }
        .input:focus { border-color: #0073ea; box-shadow: 0 0 0 2px rgba(0,115,234,0.1); }
      `}</style>
    </div>
  );
}

// Static class map — Tailwind JIT cannot detect interpolated class names.
const COL_SPAN_CLASSES: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  12: "md:col-span-12",
};

function Field({ label, colSpan, children }: { label: string; colSpan: number; children: React.ReactNode }) {
  return (
    <div className={COL_SPAN_CLASSES[colSpan] ?? "md:col-span-3"}>
      <label className="block text-xs font-medium mb-1" style={{ color: "#676879" }}>{label}</label>
      {children}
    </div>
  );
}
