"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { get, post } from "@/lib/api-client";
import type { ContactDetail, AccountListItem, PaginatedResult } from "@solaroo/types";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  notes: string;
  accountId: string;
  isPrimary: boolean;
  relationship: string;
};

const INITIAL: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: "",
  notes: "",
  accountId: "",
  isPrimary: false,
  relationship: "",
};

export default function NewContactPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledAccountId = searchParams.get("accountId") ?? "";

  const [form, setForm] = useState<FormState>({ ...INITIAL, accountId: prefilledAccountId });
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Load accounts for the dropdown
  useEffect(() => {
    get<PaginatedResult<AccountListItem>>("/accounts?pageSize=200&isActive=true&sortBy=name&sortDir=asc")
      .then((r) => setAccounts(r.items))
      .catch(() => {});
  }, []);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Enter a valid email address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const contact = await post<ContactDetail>("/contacts", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        department: form.department.trim() || undefined,
        notes: form.notes.trim() || undefined,
        accountId: form.accountId || undefined,
        isPrimary: form.isPrimary,
        relationship: form.relationship.trim() || undefined,
      });
      // Redirect to account detail if we came from one, else contact detail
      if (prefilledAccountId) {
        router.push(`/accounts/${prefilledAccountId}`);
      } else {
        router.push(`/contacts/${contact.id}`);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setSubmitting(false);
    }
  }

  const backHref = prefilledAccountId ? `/accounts/${prefilledAccountId}` : "/contacts";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={backHref} className="hover:text-foreground">
          ← Back
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Contact</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">New Contact</h1>
        <p className="text-sm text-muted-foreground">Add a person linked to an account</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Personal Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors.firstName ? "border-destructive" : "border-input"}`}
              />
              {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors.lastName ? "border-destructive" : "border-input"}`}
              />
              {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={`w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${errors.email ? "border-destructive" : "border-input"}`}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+60 12 345 6789"
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Job Title</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                placeholder="e.g. Project Director"
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </section>

        {/* Account linkage */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Account Linkage
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Account</label>
              <select
                value={form.accountId}
                onChange={(e) => set("accountId", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— No account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.accountCode})
                  </option>
                ))}
              </select>
            </div>
            {form.accountId && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Relationship</label>
                  <input
                    type="text"
                    value={form.relationship}
                    onChange={(e) => set("relationship", e.target.value)}
                    placeholder="e.g. Decision Maker, Technical Lead"
                    className="w-full h-9 rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={form.isPrimary}
                    onChange={(e) => set("isPrimary", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="isPrimary" className="text-sm font-medium">
                    Primary contact for this account
                  </label>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="Any relevant context about this contact…"
            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={backHref} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Contact"}
          </button>
        </div>
      </form>
    </div>
  );
}
