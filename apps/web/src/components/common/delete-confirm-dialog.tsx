"use client";

// DeleteConfirmDialog — reusable confirmation modal for destructive deletes.
// Used by Account, Contact, Site, Opportunity detail pages.
//
// Behaviour:
//  - Renders nothing when `open` is false
//  - Backdrop blocks page interaction
//  - User must type the resource code (e.g. "OPP-26-004") exactly to enable
//    the Delete button — protects against fat-finger deletion
//  - On Delete click, calls onConfirm() (parent handles the API call)
//  - Surfaces server error inline (e.g. "Cannot delete — still referenced by ...")

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  /** Type of record (e.g. "Opportunity", "Account") — shown in heading. */
  resourceLabel: string;
  /** Human code the user must retype to confirm (e.g. "OPP-26-004"). */
  confirmText: string;
  /** Optional one-line description of what will be deleted. */
  description?: string;
  /** Called when user confirms. Should throw on failure so we can surface the message. */
  onConfirm: () => Promise<void>;
  /** Called whenever the dialog closes (cancel, success, esc). */
  onClose: () => void;
}

export function DeleteConfirmDialog({
  open,
  resourceLabel,
  confirmText,
  description,
  onConfirm,
  onClose,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // ESC closes the dialog (unless mid-submit).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const canDelete = typed === confirmText && !submitting;

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 17, 21, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          width: "min(440px, calc(100vw - 32px))",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          fontFamily: "Calibri, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle size={22} color="#e2445c" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#323338", margin: 0 }}>
              Delete this {resourceLabel.toLowerCase()}?
            </h2>
            <p style={{ fontSize: 13, color: "#676879", margin: "6px 0 0", lineHeight: 1.5 }}>
              {description ?? "This action cannot be undone."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: submitting ? "not-allowed" : "pointer",
              color: "#676879",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <label
            htmlFor="delete-confirm-input"
            style={{ display: "block", fontSize: 12, color: "#676879", marginBottom: 6 }}
          >
            Type{" "}
            <code
              style={{
                background: "#f0f1f4",
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 12,
                color: "#323338",
              }}
            >
              {confirmText}
            </code>{" "}
            to confirm.
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={submitting}
            autoFocus
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13,
              border: "1px solid #d0d4dc",
              borderRadius: 4,
              outline: "none",
              fontFamily: "monospace",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#fbe9eb",
              border: "1px solid #f5c6cb",
              borderRadius: 4,
              fontSize: 12,
              color: "#a52840",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              background: "#fff",
              color: "#323338",
              border: "1px solid #d0d4dc",
              borderRadius: 4,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              background: canDelete ? "#e2445c" : "#f0d0d6",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: canDelete ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
