"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { get } from "@/lib/api-client";
import type { ContactListItem, PaginatedResult } from "@solaroo/types";

const PAGE_SIZE = 25;

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const accountIdFilter = searchParams.get("accountId") ?? "";

  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: "lastName",
        sortDir: "asc",
        ...(search && { search }),
        ...(accountIdFilter && { accountId: accountIdFilter }),
      });
      const result = await get<PaginatedResult<ContactListItem>>(
        `/contacts?${params}`
      );
      setContacts(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, search, accountIdFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchContacts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchContacts, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const newContactHref = accountIdFilter
    ? `/contacts/new?accountId=${accountIdFilter}`
    : "/contacts/new";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            People linked to your accounts
          </p>
        </div>
        <Link
          href={newContactHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          + New Contact
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} contact${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {search ? "No contacts match your search." : "No contacts yet. Add your first contact."}
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const primaryAccount =
                    contact.accounts.find((a) => a.isPrimary) ??
                    contact.accounts[0];
                  return (
                    <tr key={contact.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {contact.firstName} {contact.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {contact.jobTitle ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-primary hover:underline"
                          >
                            {contact.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {contact.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {primaryAccount ? (
                          <Link
                            href={`/accounts/${primaryAccount.account.id}`}
                            className="text-sm hover:text-primary hover:underline"
                          >
                            {primaryAccount.account.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${contact.isActive ? "bg-green-500" : "bg-gray-300"}`}
                          title={contact.isActive ? "Active" : "Inactive"}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
