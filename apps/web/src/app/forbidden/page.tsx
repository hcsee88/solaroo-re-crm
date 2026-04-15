import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access Denied" };

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md text-center space-y-6 p-8">

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
          style={{ background: "#fff5f7", color: "#e2445c" }}
        >
          🔒
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold" style={{ color: "#323338" }}>
            Access Denied
          </h1>
          <p className="text-sm" style={{ color: "#676879" }}>
            You don&apos;t have permission to view this page.
          </p>
          <p className="text-sm" style={{ color: "#676879" }}>
            If you think this is a mistake, contact your system administrator.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: "#0073ea" }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: "#e6e9ef", color: "#676879" }}
          >
            Sign in as different user
          </Link>
        </div>

      </div>
    </div>
  );
}
