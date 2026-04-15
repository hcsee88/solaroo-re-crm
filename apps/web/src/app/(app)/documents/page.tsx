import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Document Center</h1>
        <p className="text-sm text-muted-foreground">Controlled documents across all projects</p>
      </div>
      {/* DocumentSearch + DocumentTable will go here */}
    </div>
  );
}
