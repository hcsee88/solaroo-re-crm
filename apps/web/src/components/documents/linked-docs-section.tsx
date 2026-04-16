"use client";

/**
 * LinkedDocsSection — reusable document panel for Opportunity and Project detail pages.
 *
 * Renders a flat document table (docCode, title, type, status, revision, date)
 * with inline upload, download, delete, and revision history.
 *
 * Designed to be embedded directly in detail pages — NOT a standalone page.
 * All data fetching is scoped to the provided context (opportunityId or projectId).
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { get, del, uploadFile, API_BASE_URL_EXPORT } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "SUPERSEDED" | "OBSOLETE";

export type LinkedDoc = {
  id: string;
  docCode: string;
  title: string;
  docType: string;
  status: DocStatus;
  currentRevision: string | null;
  latestRevisionStatus: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  owner: { id: string; name: string } | null;
};

type DocRevision = {
  id: string;
  revision: string;
  description: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  approvalStatus: string;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  "Site Information",
  "Drawings",
  "Costing",
  "Proposal",
  "Contracts",
  "Other",
] as const;

const STATUS_LABELS: Record<DocStatus, string> = {
  DRAFT:        "Draft",
  UNDER_REVIEW: "Under Review",
  APPROVED:     "Approved",
  SUPERSEDED:   "Superseded",
  OBSOLETE:     "Obsolete",
};

const STATUS_COLOURS: Record<DocStatus, string> = {
  DRAFT:        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  UNDER_REVIEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  APPROVED:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  SUPERSEDED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  OBSOLETE:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const DOCTYPE_COLOURS: Record<string, string> = {
  "Site Information": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Drawings":         "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Costing":          "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "Proposal":         "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Contracts":        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Other":            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const APPROVAL_COLOURS: Record<string, string> = {
  PENDING:  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RETURNED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Revision History Dialog ──────────────────────────────────────────────────

function RevisionDialog({
  doc,
  onClose,
}: {
  doc: LinkedDoc;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    get<DocRevision[]>(`/documents/${doc.id}/revisions`)
      .then(setRevisions)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load revisions"))
      .finally(() => setLoading(false));
  }, [doc.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground font-mono">{doc.docCode}</p>
            <h2 className="text-base font-semibold mt-0.5">{doc.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Current revision: <span className="font-medium">{doc.currentRevision ?? "A"}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-muted" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revisions found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Rev</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Uploaded</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">By</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Size</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {revisions.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-mono font-semibold text-xs">{r.revision}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_COLOURS[r.approvalStatus] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {r.approvalStatus.charAt(0) + r.approvalStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(r.uploadedAt)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.uploadedBy?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{fmtBytes(r.fileSizeBytes)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <a
                        href={`${API_BASE_URL_EXPORT}/api/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inline Upload Form ───────────────────────────────────────────────────────

function UploadForm({
  contextType,
  contextId,
  onUploaded,
  onCancel,
}: {
  contextType: "opportunity" | "project";
  contextId: string;
  onUploaded: (doc: LinkedDoc) => void;
  onCancel: () => void;
}) {
  const [title,     setTitle]     = useState("");
  const [docType,   setDocType]   = useState<string>(DOC_TYPES[0]);
  const [notes,     setNotes]     = useState("");
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inputCls = "h-9 w-full rounded-md border border-input px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  async function handleSubmit() {
    if (!file) { setError("Please select a file"); return; }
    if (!title.trim()) { setError("Title is required"); return; }
    if (file.size > MAX_FILE_BYTES) { setError("File exceeds 15 MB limit"); return; }
    setUploading(true);
    setError(null);
    try {
      const fields: Record<string, string> = {
        title: title.trim(),
        docType,
        ...(notes.trim() && { notes: notes.trim() }),
        [contextType === "opportunity" ? "opportunityId" : "projectId"]: contextId,
      };
      const doc = await uploadFile<LinkedDoc>("/documents/upload", file, fields);
      onUploaded(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-semibold">Upload Document</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className={inputCls}
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            File <span className="text-destructive">*</span>
            <span className="ml-1 font-normal">(max 15 MB)</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-md border-2 border-dashed border-input px-4 py-4 text-center hover:border-primary transition-colors"
          >
            {file ? (
              <div className="text-sm">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{fmtBytes(file.size)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click to browse · PDF, Word, Excel, DWG, Image</p>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.jpg,.jpeg,.png,.zip,.rar"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Notes <span className="font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Brief revision note or description…"
            className="w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none bg-background"
            maxLength={1000}
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploading || !file}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
        >
          {uploading && (
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LinkedDocsSection({
  contextType,
  contextId,
  canUpload = true,
  canDelete = false,
}: {
  /** Whether this is linked to an opportunity or project */
  contextType: "opportunity" | "project";
  /** The opportunity or project ID */
  contextId: string;
  /** Show upload button (default true) */
  canUpload?: boolean;
  /** Show delete button (default false — conservative) */
  canDelete?: boolean;
}) {
  const [docs,       setDocs]       = useState<LinkedDoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [revDoc,     setRevDoc]     = useState<LinkedDoc | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const param = contextType === "opportunity" ? "opportunityId" : "projectId";
      // Request up to 100 docs; for a single context this is always sufficient
      const result = await get<{ items: LinkedDoc[] } | LinkedDoc[]>(
        `/documents?${param}=${contextId}&pageSize=100&sortBy=createdAt&sortDir=desc`,
      );
      // Handle both paginated shape { items: [] } and legacy flat array
      setDocs(Array.isArray(result) ? result : (result as { items: LinkedDoc[] }).items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [contextType, contextId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  function handleUploaded(doc: LinkedDoc) {
    setDocs((prev) => [doc, ...prev]);
    setShowUpload(false);
  }

  async function handleDelete(doc: LinkedDoc) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await del(`/documents/${doc.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      {/* Revision history dialog */}
      {revDoc && <RevisionDialog doc={revDoc} onClose={() => setRevDoc(null)} />}

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
          </p>
          {canUpload && !showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Document
            </button>
          )}
        </div>

        {/* Upload form */}
        {showUpload && (
          <UploadForm
            contextType={contextType}
            contextId={contextId}
            onUploaded={handleUploaded}
            onCancel={() => setShowUpload(false)}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && docs.length === 0 && !showUpload && (
          <div className="rounded-lg border border-dashed bg-card p-10 text-center">
            <svg className="mx-auto w-8 h-8 text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-muted-foreground">
              No documents linked to this {contextType} yet.
            </p>
            {canUpload && (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Upload the first document
              </button>
            )}
          </div>
        )}

        {/* Document table */}
        {!loading && docs.length > 0 && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Rev</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Uploaded</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                      {/* Doc code */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {doc.docCode}
                      </td>

                      {/* Title + filename */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <p className="font-medium truncate" title={doc.title}>{doc.title}</p>
                        {doc.fileName && (
                          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                        )}
                      </td>

                      {/* Doc type badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${DOCTYPE_COLOURS[doc.docType] ?? "bg-zinc-100 text-zinc-700"}`}>
                          {doc.docType}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_COLOURS[doc.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                          {STATUS_LABELS[doc.status] ?? doc.status}
                        </span>
                      </td>

                      {/* Revision */}
                      <td className="px-4 py-3 font-mono text-xs">
                        {doc.currentRevision ?? "A"}
                      </td>

                      {/* Uploaded date */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(doc.uploadedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Download */}
                          <a
                            href={`${API_BASE_URL_EXPORT}/api/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded px-2 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors whitespace-nowrap"
                          >
                            Download
                          </a>

                          {/* Revision history */}
                          <button
                            onClick={() => setRevDoc(doc)}
                            className="rounded px-2 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors"
                            title="View revision history"
                          >
                            History
                          </button>

                          {/* Delete (optional) */}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(doc)}
                              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete document"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer: link to Document Center for full view */}
            <div className="border-t px-4 py-2.5 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {docs.length} document{docs.length !== 1 ? "s" : ""} linked to this {contextType}.
              </p>
              <a
                href="/documents"
                className="text-xs text-primary hover:underline"
              >
                Open Document Center →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
