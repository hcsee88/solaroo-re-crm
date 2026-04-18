"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { get, post } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

// ─── Local types ─────────────────────────────────────────────────────────────

type AccountOption = { id: string; accountCode: string; name: string };
type SiteOption = { id: string; siteCode: string; name: string };
type OpportunityOption = { id: string; opportunityCode: string; title: string; accountId: string };
type UserOption = { id: string; name: string; email: string; roleName: string };

type FormState = {
  contractNo:                string;
  title:                     string;
  accountId:                 string;
  opportunityId:             string;
  siteId:                    string;
  projectManagerCandidateId: string;
  contractValue:             string;
  currency:                  string;
  awardedDate:               string;
  targetCod:                 string;
  scopeSummary:              string;
  paymentTerms:              string;
  notes:                     string;
};

const INITIAL: FormState = {
  contractNo:                "",
  title:                     "",
  accountId:                 "",
  opportunityId:             "",
  siteId:                    "",
  projectManagerCandidateId: "",
  contractValue:             "",
  currency:                  "MYR",
  awardedDate:               "",
  targetCod:                 "",
  scopeSummary:              "",
  paymentTerms:              "",
  notes:                     "",
};

const PM_ROLES = new Set(["PROJECT_MANAGER", "DIRECTOR", "PMO_MANAGER"]);

// ─── Page ─────────────────────────────────────────────────────────────────────

function NewContractPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledOppId     = searchParams.get("opportunityId") ?? "";
  const prefilledAccountId = searchParams.get("accountId") ?? "";

  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    opportunityId: prefilledOppId,
    accountId: prefilledAccountId,
  });
  const [accounts, setAccounts]           = useState<AccountOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [sites, setSites]                 = useState<SiteOption[]>([]);
  const [users, setUsers]                 = useState<UserOption[]>([]);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [serverError, setServerError]     = useState<string | null>(null);

  useEffect(() => {
    get<PaginatedResult<AccountOption>>("/accounts?pageSize=200&isActive=true&sortBy=name&sortDir=asc")
      .then((r) => setAccounts(r.items))
      .catch(() => {});
    get<PaginatedResult<OpportunityOption>>("/opportunities?pageSize=200&sortBy=updatedAt&sortDir=desc")
      .then((r) => setOpportunities(r.items))
      .catch(() => {});
    get<UserOption[]>("/admin/users/dropdown")
      .then((u) => setUsers(u.filter((x) => PM_ROLES.has(x.roleName))))
      .catch(() => {});
  }, []);

  // Sites filtered by account
  useEffect(() => {
    if (!form.accountId) { setSites([]); return; }
    get<PaginatedResult<SiteOption>>(`/sites?accountId=${form.accountId}&pageSize=100&isActive=true`)
      .then((r) => setSites(r.items))
      .catch(() => {});
  }, [form.accountId]);

  // When opportunity selected, auto-fill accountId if empty (or override)
  useEffect(() => {
    if (!form.opportunityId) return;
    const opp = opportunities.find((o) => o.id === form.opportunityId);
    if (opp && opp.accountId !== form.accountId) {
      setForm((p) => ({ ...p, accountId: opp.accountId, siteId: "" }));
    }
  }, [form.opportunityId, opportunities]);  // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(field: K, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "accountId") { next.siteId = ""; next.opportunityId = ""; }
      return next;
    });
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.contractNo.trim()) errs.contractNo = "Contract number is required";
    if (!form.title.trim())      errs.title = "Title is required";
    if (!form.accountId)         errs.accountId = "Account is required";
    if (!form.contractValue || isNaN(+form.contractValue) || +form.contractValue < 0) {
      errs.contractValue = "Enter a valid value";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const created = await post<{ id: string }>("/contracts", {
        contractNo:                form.contractNo.trim(),
        title:                     form.title.trim(),
        accountId:                 form.accountId,
        opportunityId:             form.opportunityId || undefined,
        siteId:                    form.siteId || undefined,
        projectManagerCandidateId: form.projectManagerCandidateId || undefined,
        contractValue:             Number(form.contractValue),
        currency:                  form.currency,
        awardedDate:               form.awardedDate || undefined,
        targetCod:                 form.targetCod || undefined,
        scopeSummary:              form.scopeSummary || undefined,
        paymentTerms:              form.paymentTerms || undefined,
        notes:                     form.notes || undefined,
      });
      router.push(`/contracts/${created.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
                  ?? (err as Error)?.message
                  ?? "Failed to create contract";
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm" style={{ color: "#676879" }}>
          <ArrowLeft className="w-4 h-4" /> Back to contracts
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>New contract</h1>
        <p className="text-sm mt-1" style={{ color: "#676879" }}>
          Capture the commercial agreement. After creation you can mark it Awarded and start the handover workflow.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6" style={{ border: "1px solid hsl(218 23% 91%)" }}>
        <Section title="Identification">
          <Field label="Contract number *" error={errors.contractNo}>
            <input
              value={form.contractNo}
              onChange={(e) => set("contractNo", e.target.value)}
              placeholder="e.g. SRE-2026-001"
              className="input"
            />
          </Field>
          <Field label="Title *" error={errors.title}>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Contract title"
              className="input"
            />
          </Field>
        </Section>

        <Section title="Linkage">
          <Field label="Account *" error={errors.accountId}>
            <select
              value={form.accountId}
              onChange={(e) => set("accountId", e.target.value)}
              className="input"
            >
              <option value="">Select an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountCode} — {a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Opportunity (recommended for handover → project)">
            <select
              value={form.opportunityId}
              onChange={(e) => set("opportunityId", e.target.value)}
              className="input"
            >
              <option value="">— None —</option>
              {opportunities
                .filter((o) => !form.accountId || o.accountId === form.accountId)
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.opportunityCode} — {o.title}</option>
                ))}
            </select>
          </Field>
          <Field label="Site (required to complete handover)">
            <select
              value={form.siteId}
              onChange={(e) => set("siteId", e.target.value)}
              className="input"
              disabled={!form.accountId}
            >
              <option value="">{form.accountId ? "— None —" : "Select an account first"}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.siteCode} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Project Manager (candidate)">
            <select
              value={form.projectManagerCandidateId}
              onChange={(e) => set("projectManagerCandidateId", e.target.value)}
              className="input"
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.roleName})</option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Commercial">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contract value *" error={errors.contractValue}>
              <input
                type="number"
                step="0.01"
                value={form.contractValue}
                onChange={(e) => set("contractValue", e.target.value)}
                placeholder="0"
                className="input"
              />
            </Field>
            <Field label="Currency">
              <input value={form.currency} onChange={(e) => set("currency", e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Payment terms">
            <input
              value={form.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
              placeholder="e.g. 30% on signing, 60% on delivery, 10% on commissioning"
              className="input"
            />
          </Field>
        </Section>

        <Section title="Schedule">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Awarded date">
              <input type="date" value={form.awardedDate} onChange={(e) => set("awardedDate", e.target.value)} className="input" />
            </Field>
            <Field label="Target COD (Commercial Operation Date)">
              <input type="date" value={form.targetCod} onChange={(e) => set("targetCod", e.target.value)} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Notes">
          <Field label="Scope summary">
            <textarea
              rows={3}
              value={form.scopeSummary}
              onChange={(e) => set("scopeSummary", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Internal notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="input"
            />
          </Field>
        </Section>

        {serverError && (
          <div className="rounded-md p-3 text-sm" style={{ background: "#fde8ec", color: "#a52840" }}>
            {serverError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/contracts"
            className="text-sm px-3 py-1.5 rounded-md border"
            style={{ borderColor: "hsl(218 23% 91%)", color: "#676879" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-medium text-white px-4 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: "#0073ea" }}
          >
            {submitting ? "Creating…" : "Create contract"}
          </button>
        </div>
      </form>

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
        .input:disabled { background: #f5f6f8; color: #a3a8b5; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#676879" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: "#676879" }}>{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
      <NewContractPageContent />
    </Suspense>
  );
}
