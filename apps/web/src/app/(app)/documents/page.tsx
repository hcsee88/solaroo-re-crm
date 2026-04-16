"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get, del, uploadFile, API_BASE_URL_EXPORT } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "SUPERSEDED" | "OBSOLETE";

type DocumentListItem = {
  id: string;
  docCode: string;
  title: string;
  docType: string;
  status: DocStatus;
  currentRevision: string | null;
  notes: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  latestRevisionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string } | null;
  project: { id: string; projectCode: string; name: string } | null;
  opportunity: { id: string; opportunityCode: string; title: string } | null;
};

type DocumentRevision = {
  id: string;
  revision: string;
  description: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  approvalStatus: string;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
};

type ProjectOption = { id: string; projectCode: string; name: string };
type OpportunityOption = { id: string; opportunityCode: string; title: string };

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
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtMime(mime: string | null): string {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("docx")) return "Word";
  if (mime.includes("excel") || mime.includes("xlsx") || mime.includes("spreadsheet")) return "Excel";
  if (mime.includes("image")) return "Image";
  if (mime.includes("zip") || mime.includes("rar")) return "Archive";
  if (mime.includes("dwg") || mime.includes("dxf")) return "Drawing";
  return mime.split("/")[1]?.toUpperCase() ?? "File";
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[200, 260, 80, 70, 40, 140, 90, 70, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-4 bg-muted rounded animate-pulse`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Revision History Dialog ──────────────────────────────────────────────────

function RevisionDialog({
  doc,
  onClose,
}: {
  doc: DocumentListItem;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<DocumentRevision[]>(`/documents/${doc.id}/revisions`)
      .then(setRevisions)
      .catch((e) => setError(e.message ?? "Failed to load revisions"))
      .finally(() => setLoading(false));
  }, [doc.id]);

  const handleDownloadRev = (revId: string) => {
    // For V1, download always serves the latest revision file
    const url = `${API_BASE_URL_EXPORT}/api/documents/${doc.id}/download`;
    window.open(url, "_blank");
  };

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
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
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
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-mono font-semibold text-xs">{r.revision}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={APPROVAL_COLOURS[r.approvalStatus] ?? "bg-zinc-100 text-zinc-600"}>
                        {r.approvalStatus.charAt(0) + r.approvalStatus.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(r.uploadedAt)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.uploadedBy?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtBytes(r.fileSizeBytes)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleDownloadRev(r.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Download
                      </button>
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

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [contextType, setContextType] = useState<"project" | "opportunity">("project");
  const [title, setTitle]       = useState("");
  const [docType, setDocType]   = useState<string>(DOC_TYPES[0]);
  const [notes, setNotes]       = useState("");
  const [selectedFile, setFile] = useState<File | null>(null);
  const [projectId, setProjectId]         = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [projects, setProjects]           = useState<ProjectOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch context lists on open
  useEffect(() => {
    get<{ items: ProjectOption[] }>("/projects?pageSize=100&sortBy=name&sortDir=asc")
      .then((r) => setProjects(r.items ?? []))
      .catch(() => {});
    get<{ items: OpportunityOption[] }>("/opportunities?pageSize=100&sortBy=title&sortDir=asc&isActive=true")
      .then((r) => setOpportunities(r.items ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) { setError("Please select a file."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    if (contextType === "project" && !projectId) { setError("Select a project."); return; }
    if (contextType === "opportunity" && !opportunityId) { setError("Select an opportunity."); return; }
    if (selectedFile.size > 15 * 1024 * 1024) { setError("File must be under 15 MB."); return; }

    const fields: Record<string, string> = {
      title,
      docType,
      ...(notes && { notes }),
      ...(contextType === "project"     ? { projectId }     : {}),
      ...(contextType === "opportunity" ? { opportunityId } : {}),
    };

    setUploading(true);
    try {
      await uploadFile("/documents/upload", selectedFile, fields);
      onUploaded();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Upload Document</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Document Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site Survey Report – Tanjung Aru"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Doc Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Document Type *</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Context type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Link To *</label>
            <div className="flex gap-3">
              {(["project", "opportunity"] as const).map((ct) => (
                <label key={ct} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="contextType"
                    value={ct}
                    checked={contextType === ct}
                    onChange={() => setContextType(ct)}
                    className="accent-primary"
                  />
                  {ct === "project" ? "Project" : "Opportunity"}
                </label>
              ))}
            </div>
          </div>

          {/* Context select */}
          {contextType === "project" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.projectCode}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Opportunity *</label>
              <select
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select an opportunity…</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    [{o.opportunityCode}] {o.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">File * <span className="text-muted-foreground font-normal">(max 15 MB)</span></label>
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-input rounded-md px-4 py-5 text-center hover:border-primary transition-colors"
            >
              {selectedFile ? (
                <div className="text-sm">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{fmtBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Click to browse or drag a file here</p>
                  <p className="text-xs mt-1">PDF, Word, Excel, DWG, Image accepted</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.png,.jpg,.jpeg,.zip,.rar"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Brief description or revision note…"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL state ──────────────────────────────────────────────────────────────
  const search  = searchParams.get("search")  ?? "";
  const docType = searchParams.get("docType") ?? "";
  const status  = searchParams.get("status")  ?? "";
  const page    = Number(searchParams.get("page") ?? "1");

  // ── Local state ────────────────────────────────────────────────────────────
  const [result,     setResult]     = useState<PaginatedResult<DocumentListItem> | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [searchText, setSearchText] = useState(search);
  const [showUpload, setShowUpload] = useState(false);
  const [revDoc,     setRevDoc]     = useState<DocumentListItem | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        v ? params.set(k, v) : params.delete(k);
      }
      params.set("page", updates.page ?? "1");
      router.push(`/documents?${params.toString()}`);
    },
    [router, searchParams],
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)  params.set("search",  search);
    if (docType) params.set("docType", docType);
    if (status)  params.set("status",  status);
    params.set("page",     String(page));
    params.set("pageSize", "20");

    get<PaginatedResult<DocumentListItem>>(`/documents?${params.toString()}`)
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, docType, status, page]);

  useEffect(() => { load(); }, [load]);

  // ── Search debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchText !== search) push({ search: searchText });
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await del(`/documents/${deleteId}`);
      setDeleteId(null);
      load();
    } catch (e: any) {
      alert(e.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const items = result?.items ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Document Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Controlled documents across all projects and opportunities
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by title or code…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Doc Type */}
        <select
          value={docType}
          onChange={(e) => push({ docType: e.target.value })}
          className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Types</option>
          {(["Site Information","Drawings","Costing","Proposal","Contracts","Other"] as const).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => push({ status: e.target.value })}
          className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="SUPERSEDED">Superseded</option>
          <option value="OBSOLETE">Obsolete</option>
        </select>

        {/* Clear filters */}
        {(search || docType || status) && (
          <button
            onClick={() => { setSearchText(""); push({ search: "", docType: "", status: "" }); }}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        )}

        {/* Count */}
        {result && (
          <span className="ml-auto text-sm text-muted-foreground">
            {result.total} document{result.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs whitespace-nowrap">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Rev</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Linked To</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs whitespace-nowrap">Uploaded</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Size</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : items.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="text-muted-foreground text-sm">
                        <svg className="h-8 w-8 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        {search || docType || status
                          ? "No documents match your filters."
                          : "No documents uploaded yet. Click \"Upload Document\" to add one."}
                      </div>
                    </td>
                  </tr>
                )
                : items.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Code */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {doc.docCode}
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate" title={doc.title}>{doc.title}</p>
                      {doc.owner && (
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.owner.name}</p>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={DOCTYPE_COLOURS[doc.docType] ?? "bg-zinc-100 text-zinc-700"}>
                        {doc.docType}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={STATUS_COLOURS[doc.status] ?? "bg-zinc-100 text-zinc-700"}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </Badge>
                    </td>

                    {/* Revision */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-semibold text-sm">
                        {doc.currentRevision ?? "A"}
                      </span>
                    </td>

                    {/* Linked To */}
                    <td className="px-4 py-3">
                      {doc.project ? (
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{doc.project.projectCode}</p>
                          <p className="text-xs truncate max-w-32" title={doc.project.name}>
                            {doc.project.name}
                          </p>
                        </div>
                      ) : doc.opportunity ? (
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{doc.opportunity.opportunityCode}</p>
                          <p className="text-xs truncate max-w-32" title={doc.opportunity.title}>
                            {doc.opportunity.title}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Uploaded */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {fmtDate(doc.uploadedAt ?? doc.createdAt)}
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {fmtBytes(doc.fileSizeBytes)}
                      {doc.mimeType && (
                        <span className="ml-1 text-xs opacity-70">({fmtMime(doc.mimeType)})</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Download */}
                        <button
                          onClick={() =>
                            window.open(`${API_BASE_URL_EXPORT}/api/documents/${doc.id}/download`, "_blank")
                          }
                          title="Download latest revision"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>

                        {/* Revision history */}
                        <button
                          onClick={() => setRevDoc(doc)}
                          title="Revision history"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteId(doc.id)}
                          title="Delete document"
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M10 3h4a1 1 0 011 1v1H9V4a1 1 0 011-1z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {result.page} of {result.totalPages} · {result.total} documents
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => push({ page: String(page - 1) })}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => push({ page: String(page + 1) })}
              disabled={page >= result.totalPages}
              className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold">Delete Document?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the document and all its revisions from disk. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={() => { load(); }}
        />
      )}

      {revDoc && (
        <RevisionDialog
          doc={revDoc}
          onClose={() => setRevDoc(null)}
        />
      )}
    </div>
  );
}
