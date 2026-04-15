// Default checklist items for each project gate.
// These are seeded when a gate is created (Gate 1 at project creation,
// subsequent gates when the PM activates them).

export type ChecklistItemTemplate = {
  description: string;
  isRequired: boolean;
};

export const GATE_CHECKLIST_TEMPLATES: Record<number, ChecklistItemTemplate[]> = {
  1: [
    // Gate 1: Contract & Project Handover
    { description: "Signed contract uploaded and filed", isRequired: true },
    { description: "Contract summary completed", isRequired: true },
    { description: "Approved proposal version identified and frozen", isRequired: true },
    { description: "Sales-to-project handover meeting conducted", isRequired: true },
    { description: "Project team assigned (PM, Design Lead, Procurement Lead)", isRequired: true },
    { description: "Initial milestone plan drafted", isRequired: true },
    { description: "Budget baseline entered", isRequired: true },
    { description: "Client kickoff meeting scheduled", isRequired: false },
  ],
  2: [
    // Gate 2: Design Freeze
    { description: "Design Basis Document (DBD) uploaded and approved", isRequired: true },
    { description: "Single-line diagram issued for approval", isRequired: true },
    { description: "Equipment freeze list approved", isRequired: true },
    { description: "Interface matrix completed", isRequired: true },
    { description: "Design review conducted", isRequired: true },
    { description: "Budget updated with design freeze cost estimate", isRequired: true },
    { description: "Margin at design freeze reviewed and signed off", isRequired: true },
    { description: "Client comments on design addressed", isRequired: false },
  ],
  3: [
    // Gate 3: Procurement Release
    { description: "Purchase orders issued for long-lead items", isRequired: true },
    { description: "Delivery schedule confirmed with vendors", isRequired: true },
    { description: "Import/logistics plan confirmed (if applicable)", isRequired: false },
    { description: "Site mobilization plan approved", isRequired: true },
    { description: "HSE plan submitted and acknowledged", isRequired: true },
    { description: "All required permits and approvals obtained", isRequired: true },
    { description: "Subcontractor agreements signed (if applicable)", isRequired: false },
  ],
  4: [
    // Gate 4: Site Execution
    { description: "Site mobilization complete", isRequired: true },
    { description: "All equipment delivered and inspected on site", isRequired: true },
    { description: "Civil/structural works complete", isRequired: true },
    { description: "Electrical installation complete", isRequired: true },
    { description: "QA/QC inspections signed off", isRequired: true },
    { description: "Punch list raised and reviewed with client", isRequired: true },
    { description: "Critical punch items cleared", isRequired: true },
    { description: "As-built drawings initiated", isRequired: false },
  ],
  5: [
    // Gate 5: Testing, Commissioning & Handover
    { description: "All commissioning tests completed and signed off", isRequired: true },
    { description: "FAT/SAT records uploaded", isRequired: true },
    { description: "System performance verified against design basis", isRequired: true },
    { description: "As-built drawings issued", isRequired: true },
    { description: "O&M manual issued to client", isRequired: true },
    { description: "Warranty documentation signed", isRequired: true },
    { description: "Asset register created in system", isRequired: true },
    { description: "Punch list fully cleared or accepted", isRequired: true },
    { description: "Client acceptance certificate obtained", isRequired: true },
    { description: "O&M plan activated", isRequired: false },
  ],
  6: [
    // Gate 6: Financial Close-out
    { description: "Final invoice issued", isRequired: true },
    { description: "All outstanding invoices settled", isRequired: true },
    { description: "Retention release conditions met", isRequired: true },
    { description: "Final cost-to-complete vs. budget reconciled", isRequired: true },
    { description: "Final margin recorded", isRequired: true },
    { description: "Lessons learned documented", isRequired: false },
    { description: "Project archive completed", isRequired: true },
  ],
};
