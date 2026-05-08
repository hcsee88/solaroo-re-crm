"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { get, patch, del } from "@/lib/api-client";
import type { AccountDetail, AccountType, ContactListItem, PaginatedResult } from "@solaroo/types";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLOURS } from "@solaroo/types";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ type }: { type: AccountType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCOUNT_TYPE_COLOURS[type]}`}
    >
      {ACCOUNT_TYPE_LABELS[type]}
    </span>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
  if (href && value > 0)
    return (
      <Link href={href} className="hover:ring-2 hover:ring-ring rounded-lg">
        {inner}
      </Link>
    );
  return inner;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          label.toLowerCase() === "website" ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

// ─── Embedded contacts list ───────────────────────────────────────────────────

function AccountContactsTab({ accountId }: { accountId: string }) {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await get<PaginatedResult<ContactListItem>>(
        `/contacts?accountId=${accountId}&pageSize=100&sortBy=lastName&sortDir=asc`
      );
      setContacts(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-sm font-semibold">Contacts</h3>
        <Link
          href={`/contacts/new?accountId=${accountId}`}
          className="text-xs text-primary hover:underline"
        >
          + Add Contact
        </Link>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-32 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No contacts for this account yet.{" "}
          <Link href={`/contacts/new?accountId=${accountId}`} className="text-primary hover:underline">
            Add the first one →
          </Link>
        </div>
      ) : (
        <div className="divide-y">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              {/* Details */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-sm font-medium hover:text-primary hover:underline"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {contact.jobTitle && (
                    <span className="text-xs text-muted-foreground">{contact.jobTitle}</span>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline">
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <span className="text-xs text-muted-foreground">{contact.phone}</span>
                  )}
                </div>
              </div>
              {/* Status */}
              {!contact.isActive && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
                  Inactive
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "contacts" | "sites" | "opportunities" | "activities"
  >("overview");

  useEffect(() => {
    setLoading(true);
    get<AccountDetail>(`/accounts/${id}`)
      .then(setAccount)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load account")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Account not found"}
      </div>
    );
  }

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: `Contacts (${account._count.contacts})` },
    { key: "sites", label: `Sites (${account._count.sites})` },
    {
      key: "opportunities",
      label: `Opportunities (${account._count.opportunities})`,
    },
    { key: "activities", label: "Activities" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/accounts" className="hover:text-foreground">
          Accounts
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{account.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{account.name}</h1>
            <Badge type={account.type} />
            {!account.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            {account.accountCode}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/accounts/${id}/edit`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-red-50"
            style={{ color: "#e2445c", borderColor: "#f5c6cb" }}
          >
            Delete
          </button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={showDelete}
        resourceLabel="Account"
        confirmText={account.accountCode}
        description={`Permanently deletes "${account.name}". Refused if it has any sites, contacts, opportunities, or projects.`}
        onConfirm={async () => {
          await del(`/accounts/${id}`);
          router.push("/accounts");
        }}
        onClose={() => setShowDelete(false)}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Contacts" value={account._count.contacts} />
        <StatCard label="Sites" value={account._count.sites} />
        <StatCard label="Opportunities" value={account._count.opportunities} />
        <StatCard label="Projects" value={account._count.projects} />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Details card */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Account Details</h3>
            <dl className="space-y-3">
              <Field label="Company Name" value={account.name} />
              <Field label="Type" value={ACCOUNT_TYPE_LABELS[account.type]} />
              <Field label="Industry" value={account.industry} />
              <Field label="Registration No." value={account.registrationNo} />
              <Field label="Website" value={account.website} />
            </dl>
          </div>

          {/* Location card */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Location</h3>
            <dl className="space-y-3">
              <Field label="Country" value={account.country} />
              <Field label="State / Region" value={account.region} />
            </dl>

            {account.notes && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {account.notes}
                </p>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>
                Created{" "}
                {new Date(account.createdAt).toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span>
                Last updated{" "}
                {new Date(account.updatedAt).toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "contacts" && (
        <AccountContactsTab accountId={id} />
      )}

      {activeTab === "sites" && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-semibold">Sites</h3>
            <Link href={`/sites/new?accountId=${id}`} className="text-xs text-primary hover:underline">+ Add Site</Link>
          </div>
          <div className="p-4 text-center">
            <Link href={`/sites?accountId=${id}`} className="text-sm text-primary hover:underline">
              View all sites for this account →
            </Link>
          </div>
        </div>
      )}

      {activeTab === "opportunities" && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-semibold">Opportunities</h3>
            <Link
              href={`/opportunities/new?accountId=${id}`}
              className="text-xs text-primary hover:underline"
            >
              + New Opportunity
            </Link>
          </div>
          <div className="p-8 text-center text-sm text-muted-foreground">
            Opportunities module coming soon.
          </div>
        </div>
      )}

      {activeTab === "activities" && (
        <ActivityTimeline accountId={id} />
      )}
    </div>
  );
}
