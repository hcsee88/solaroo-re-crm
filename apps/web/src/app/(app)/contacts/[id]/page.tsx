"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { get, del } from "@/lib/api-client";
import type { ContactDetail } from "@solaroo/types";
import { DeleteConfirmDialog } from "@/components/common/delete-confirm-dialog";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          label.toLowerCase() === "email" ? (
            <a href={`mailto:${value}`} className="text-primary hover:underline">{value}</a>
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

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    get<ContactDetail>(`/contacts/${id}`)
      .then(setContact)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contact"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Contact not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contacts" className="hover:text-foreground">Contacts</Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {contact.firstName} {contact.lastName}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {contact.firstName} {contact.lastName}
            </h1>
            {!contact.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
            )}
          </div>
          {contact.jobTitle && (
            <p className="text-sm text-muted-foreground">
              {contact.jobTitle}
              {contact.department ? ` · ${contact.department}` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/contacts/${id}/edit`}
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
        resourceLabel="Contact"
        confirmText={`${contact.firstName} ${contact.lastName}`}
        description="Permanently deletes this contact and all their account links."
        onConfirm={async () => {
          await del(`/contacts/${id}`);
          router.push("/contacts");
        }}
        onClose={() => setShowDelete(false)}
      />

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact info */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Contact Details</h3>
          <dl className="space-y-3">
            <Field label="Email" value={contact.email} />
            <Field label="Phone" value={contact.phone} />
            <Field label="Job Title" value={contact.jobTitle} />
            <Field label="Department" value={contact.department} />
          </dl>
        </div>

        {/* Accounts */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Accounts</h3>
            <span className="text-xs text-muted-foreground">
              {contact.accounts.length} linked
            </span>
          </div>
          {contact.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any account.</p>
          ) : (
            <ul className="space-y-3">
              {contact.accounts.map((link) => (
                <li
                  key={link.account.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <Link
                      href={`/accounts/${link.account.id}`}
                      className="text-sm font-medium hover:text-primary hover:underline"
                    >
                      {link.account.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {link.account.accountCode}
                      {link.relationship ? ` · ${link.relationship}` : ""}
                    </p>
                  </div>
                  {link.isPrimary && (
                    <span className="rounded-full bg-solar-100 text-solar-800 px-2 py-0.5 text-xs font-medium">
                      Primary
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {contact.notes && (
          <div className="md:col-span-2 rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{contact.notes}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>
              Created{" "}
              {new Date(contact.createdAt).toLocaleDateString("en-MY", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
            <span>
              Last updated{" "}
              {new Date(contact.updatedAt).toLocaleDateString("en-MY", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
