import type { Metadata } from "next";

export const metadata: Metadata = { title: "O&M" };

export default function OmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operations & Maintenance</h1>
        <p className="text-sm text-muted-foreground">Installed asset fleet, tickets, and maintenance</p>
      </div>
      {/* AssetFleetOverview + TicketQueue + MaintenanceDue will go here */}
    </div>
  );
}
