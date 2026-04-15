"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get } from "@/lib/api-client";
import type { SiteDetail, SiteGridCategory } from "@solaroo/types";
import { SITE_GRID_CATEGORY_LABELS, SITE_GRID_CATEGORY_COLOURS } from "@solaroo/types";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<SiteDetail>(`/sites/${id}`)
      .then(setSite)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load site"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-48 rounded bg-muted" /><div className="h-4 w-32 rounded bg-muted" /></div>;
  }

  if (error || !site) {
    return <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error ?? "Site not found"}</div>;
  }

  const cat = site.gridCategory as SiteGridCategory;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/sites" className="hover:text-foreground">Sites</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{site.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{site.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SITE_GRID_CATEGORY_COLOURS[cat]}`}>
              {SITE_GRID_CATEGORY_LABELS[cat]}
            </span>
            {!site.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
            )}
          </div>
          <p className="text-sm font-mono text-muted-foreground">{site.siteCode}</p>
          <Link href={`/accounts/${site.account.id}`} className="text-sm text-muted-foreground hover:text-primary hover:underline">
            {site.account.name}
          </Link>
        </div>
        <Link href={`/sites/${id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Edit</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Opportunities" value={site._count.opportunities} />
        <StatCard label="Projects" value={site._count.projects} />
        <StatCard label="Assets" value={site._count.assets} />
      </div>

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Site Details</h3>
          <dl className="space-y-3">
            <Field label="Grid Category" value={SITE_GRID_CATEGORY_LABELS[cat]} />
            <Field label="Operating Schedule" value={site.operatingSchedule} />
            <Field label="Address" value={site.address} />
            <Field label="Region" value={site.region} />
            <Field label="Country" value={site.country} />
            {(site.latitude || site.longitude) && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coordinates</dt>
                <dd className="mt-0.5 text-sm font-mono">
                  {site.latitude}, {site.longitude}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Constraints</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Access</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground whitespace-pre-line">
                {site.accessConstraints ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Safety</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground whitespace-pre-line">
                {site.safetyConstraints ?? "—"}
              </dd>
            </div>
          </dl>
        </div>

        {site.notes && (
          <div className="md:col-span-2 rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{site.notes}</p>
          </div>
        )}

        <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>Created {new Date(site.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span>Last updated {new Date(site.updatedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
