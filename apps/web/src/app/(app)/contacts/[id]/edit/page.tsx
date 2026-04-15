"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { get, patch, del } from "@/lib/api-client";
import type { ContactDetail, AccountListItem, PaginatedResult } from "@solaroo/types";
import { Trash2, Pencil, Check, X } from "lucide-react";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  notes: string;
  isActive: boolean;
  // Add new account link
  accountId: string;
  isPrimary: boolean;
  relationship: string;
};

// Inline edit state for an existing link
type LinkEdit = {
  relationship: string;
  isPrimary: boolean;
};

export default function EditContactPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", email: "", phone: "",
    jobTitle: "", department: "", notes: "", isActive: true,
    accountId: "", isPrimary: false, relationship: "",
  });
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Per-link inline edit state: accountId -> editing state or null
  const [editingLink, setEditingLink] = useState<Record<string, LinkEdit | null>>({});
  const [savingLink, setSavingLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);

  const loadContact = () =>
    get<ContactDetail>(`/contacts/${id}`).then((c) => {
      setContact(c);
      const linkedIds = new Set(c.accounts.map((a) => a.account.id));
      setAccounts((prev) => prev.filter((a) => !linkedIds.has(a.id)));
    });

  useEffect(() => {
    Promise.all([
      get<ContactDetail>(`/contacts/${id}`),
      get<PaginatedResult<AccountListItem>>(
        "/accounts?pageSize=200&isActive=true&sortBy=name&sortDir=asc"
      ),
    ])
      .then(([c, acc]) => {
        setContact(c);
        const linkedIds = new Set(c.accounts.map((a) => a.account.id));
        setAccounts(acc.items.filter((a) => !linkedIds.has(a.id)));
        setForm((prev) => ({
          ...prev,
          firstName: c.firstName, lastName: c.lastName,
          email: c.email ?? "", phone: c.phone ?? "",
          jobTitle: c.jobTitle ?? "", department: c.department ?? "",
          notes: c.notes ?? "", isActive: c.isActive,
        }));
      })
      .catch((err) => setServerError(err instanceof Error ? err.message : "Failed to load contact"))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (typeof value === "string") {
      setErrors((prev) => { const next = { ...prev }; delete next[field as string]; return next; });
    }
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
      await patch(`/contacts/${id}`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        department: form.department.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
        ...(form.accountId && {
          accountId: form.accountId,
          isPrimary: form.isPrimary,
          relationship: form.relationship.trim() || undefined,
        }),
      });
      router.push(`/contacts/${id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update contact");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Inline link editing ────────────────────────────────────────────────────

  function startEditLink(accountId: string, current: { relationship: string | null; isPrimary: boolean }) {
    setEditingLink((prev) => ({
      ...prev,
      [accountId]: { relationship: current.relationship ?? "", isPrimary: current.isPrimary },
    }));
  }

  function cancelEditLink(accountId: string) {
    setEditingLink((prev) => ({ ...prev, [accountId]: null }));
  }

  async function saveLink(accountId: string) {
    const edits = editingLink[accountId];
    if (!edits) return;
    setSavingLink(accountId);
    try {
      const updated = await patch<ContactDetail>(`/contacts/${id}/accounts/${accountId}`, {
        isPrimary: edits.isPrimary,
        relationship: edits.relationship.trim() || null,
      });
      setContact(updated);
      setEditingLink((prev) => ({ ...prev, [accountId]: null }));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update link");
    } finally {
      setSavingLink(null);
    }
  }

  async function deleteLink(accountId: string) {
    if (!confirm("Remove this account link?")) return;
    setDeletingLink(accountId);
    try {
      const updated = await del<ContactDetail>(`/contacts/${id}/accounts/${accountId}`);
      setContact(updated);
      // Add account back to the "add" dropdown
      const removedAccount = contact?.accounts.find((a) => a.account.id === accountId)?.account;
      if (removedAccount) {
        setAccounts((prev) => [...prev, { id: removedAccount.id, accountCode: removedAccount.accountCode, name: removedAccount.name } as AccountListItem]);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to remove link");
    } finally {
      setDeletingLink(null);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  const inputClass = (field: string) =>
    `w-full h-9 rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${
      errors[field] ? "border-destructive" : "border-input"
    }`;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="rounded-lg border bg-card p-5 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!contact && serverError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {serverError}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contacts" className="hover:text-foreground">Contacts</Link>
        <span>/</span>
        <Link href={`/contacts/${id}`} className="hover:text-foreground">
          {contact?.firstName} {contact?.lastName}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Edit Contact</h1>
        <p className="text-sm text-muted-foreground">Update details for {contact?.firstName} {contact?.lastName}</p>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal details */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name <span className="text-destructive">*</span></label>
              <input type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass("firstName")} />
              {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name <span className="text-destructive">*</span></label>
              <input type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass("lastName")} />
              {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass("email")} />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+60 12 345 6789" className={inputClass("phone")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Job Title</label>
              <input type="text" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. Project Director" className={inputClass("jobTitle")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <input type="text" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Engineering" className={inputClass("department")} />
            </div>
          </div>
        </section>

        {/* Account Linkage */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account Linkage</h2>

          {/* Existing links — with edit + delete */}
          {contact && contact.accounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Linked accounts</p>
              <ul className="space-y-2">
                {contact.accounts.map((link) => {
                  const accId = link.account.id;
                  const editing = editingLink[accId];
                  const isSaving = savingLink === accId;
                  const isDeleting = deletingLink === accId;

                  return (
                    <li key={accId} className="rounded-md border bg-muted/30 px-3 py-2.5">
                      {editing ? (
                        /* Inline edit mode */
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{link.account.name} <span className="text-xs text-muted-foreground font-mono">{link.account.accountCode}</span></p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={editing.relationship}
                              onChange={(e) => setEditingLink((prev) => ({ ...prev, [accId]: { ...editing, relationship: e.target.value } }))}
                              placeholder="Relationship (optional)"
                              className="h-8 rounded-md border border-input px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editing.isPrimary}
                                onChange={(e) => setEditingLink((prev) => ({ ...prev, [accId]: { ...editing, isPrimary: e.target.checked } }))}
                                className="h-4 w-4 rounded border-input"
                              />
                              Primary contact
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveLink(accId)}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEditLink(accId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium hover:bg-muted"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{link.account.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground font-mono">{link.account.accountCode}</span>
                            {link.relationship && (
                              <span className="ml-2 text-xs text-muted-foreground">· {link.relationship}</span>
                            )}
                            {link.isPrimary && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Primary</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditLink(accId, { relationship: link.relationship, isPrimary: link.isPrimary })}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit link"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLink(accId)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Remove link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Add new link */}
          <div className="space-y-3">
            {contact && contact.accounts.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground">Link to another account</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Account</label>
                <select
                  value={form.accountId}
                  onChange={(e) => set("accountId", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">
                    {accounts.length === 0 ? "— All accounts already linked —" : "— Select account to link —"}
                  </option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.accountCode})</option>
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
                    <label htmlFor="isPrimary" className="text-sm font-medium">Primary contact for this account</label>
                  </div>
                </>
              )}
            </div>
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

        {/* Status */}
        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="isActive" className="text-sm font-medium">Active contact</label>
            <span className="text-xs text-muted-foreground">(Inactive contacts are hidden from dropdowns and lists by default)</span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/contacts/${id}`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
