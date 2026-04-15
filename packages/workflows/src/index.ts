import type { OpportunityStage } from "@solaroo/db";

// ─── Opportunity Stage Transitions ───────────────────────────────────────────

type StageTransitionRule = {
  allowedNext: OpportunityStage[];
  requiresReason?: boolean;
};

export const OPPORTUNITY_STAGE_TRANSITIONS: Record<
  OpportunityStage,
  StageTransitionRule
> = {
  LEAD: {
    allowedNext: ["QUALIFIED", "LOST", "ON_HOLD"],
  },
  QUALIFIED: {
    allowedNext: ["DATA_COLLECTION", "LOST", "ON_HOLD"],
  },
  DATA_COLLECTION: {
    allowedNext: ["SITE_ASSESSMENT_PENDING", "LOST", "ON_HOLD"],
  },
  SITE_ASSESSMENT_PENDING: {
    allowedNext: ["CONCEPT_DESIGN", "LOST", "ON_HOLD"],
  },
  CONCEPT_DESIGN: {
    allowedNext: ["BUDGETARY_PROPOSAL", "FIRM_PROPOSAL", "LOST", "ON_HOLD"],
  },
  BUDGETARY_PROPOSAL: {
    allowedNext: ["FIRM_PROPOSAL", "NEGOTIATION", "LOST", "ON_HOLD"],
  },
  FIRM_PROPOSAL: {
    allowedNext: ["NEGOTIATION", "LOST", "ON_HOLD"],
  },
  NEGOTIATION: {
    allowedNext: ["CONTRACTING", "LOST", "ON_HOLD"],
  },
  CONTRACTING: {
    allowedNext: ["WON", "LOST", "ON_HOLD"],
  },
  WON: {
    allowedNext: [], // terminal — project is created
  },
  LOST: {
    allowedNext: ["LEAD"], // can re-open a lost opportunity
    requiresReason: true,
  },
  ON_HOLD: {
    allowedNext: ["LEAD", "QUALIFIED", "DATA_COLLECTION", "LOST"],
  },
};

export function canTransitionStage(
  from: OpportunityStage,
  to: OpportunityStage
): boolean {
  const rule = OPPORTUNITY_STAGE_TRANSITIONS[from];
  return rule.allowedNext.includes(to);
}

export function assertValidTransition(
  from: OpportunityStage,
  to: OpportunityStage
): void {
  if (!canTransitionStage(from, to)) {
    throw new Error(
      `Invalid stage transition: ${from} → ${to}. Allowed: ${OPPORTUNITY_STAGE_TRANSITIONS[from].allowedNext.join(", ") || "none"}`
    );
  }
}

// ─── Gate Deliverable Templates ───────────────────────────────────────────────
// Maps directly to the project file folder structure:
//   G1-01 = Gate 1, Deliverable 01
//   G2-01-01 = Gate 2, Deliverable 01, Sub-item 01

export type GateDeliverableTemplate = {
  code: string;       // e.g. "G1-01", "G2-01-01"
  name: string;       // e.g. "Contract Pack"
  description: string; // guidance for the user uploading this deliverable
  isRequired: boolean;
  sortOrder: number;
};

export type GateTemplate = {
  gateNo: number;
  gateName: string;
  deliverables: GateDeliverableTemplate[];
};

export const GATE_TEMPLATES: GateTemplate[] = [
  // ─── Gate 1: Contract & Project Handover ────────────────────────────────────
  {
    gateNo: 1,
    gateName: "Contract & Project Handover",
    deliverables: [
      {
        code: "G1-01-01",
        name: "Letter of Award / Work Order / PO",
        description: "Signed LOA, Work Order, or Purchase Order from client. Must be stamped where required.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G1-01-02",
        name: "Final Proposal",
        description: "The proposal version accepted by the client. Must match the awarded scope.",
        isRequired: true,
        sortOrder: 20,
      },
      {
        code: "G1-01-03",
        name: "Scope of Work",
        description: "Detailed scope of work document — activities, deliverables, exclusions, and assumptions.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G1-01-04",
        name: "BOQ Breakdown",
        description: "Bill of Quantities with line-item cost breakdown by work package.",
        isRequired: true,
        sortOrder: 40,
      },
      {
        code: "G1-01-05",
        name: "Terms & Conditions",
        description: "Contract T&C — payment terms, warranties, liabilities, and penalties.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G1-01-06",
        name: "Project Completion Timeline",
        description: "Master project schedule / Gantt chart with phases, milestones, and key dates.",
        isRequired: true,
        sortOrder: 60,
      },
      {
        code: "G1-01-07",
        name: "Key Contacts & Important Info",
        description: "Stakeholder contact list, key communications, and important project information.",
        isRequired: false,
        sortOrder: 70,
      },
      {
        code: "G1-02",
        name: "Project Confirmation Form",
        description: "Signed internal project confirmation form — confirms PM, budget owner, technical lead, and approval.",
        isRequired: true,
        sortOrder: 80,
      },
      {
        code: "G1-03",
        name: "Baseline Budget",
        description: "Approved baseline budget by cost category (Labour, Materials, Equipment, Contingency, etc.).",
        isRequired: true,
        sortOrder: 90,
      },
      {
        code: "G1-04",
        name: "Internal Kick-Off Meeting (IKOM)",
        description: "Internal kick-off meeting minutes — confirms handover from Sales to Project team.",
        isRequired: false,
        sortOrder: 100,
      },
    ],
  },

  // ─── Gate 2: Design Freeze ───────────────────────────────────────────────────
  {
    gateNo: 2,
    gateName: "Design Freeze",
    deliverables: [
      {
        code: "G2-01-01",
        name: "Design Summary",
        description: "High-level design summary — system capacity, efficiency, component specs, and performance targets.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G2-01-02",
        name: "Design Methodology",
        description: "Technical design approach and calculation methodology (e.g. BESS design methodology document).",
        isRequired: true,
        sortOrder: 20,
      },
      {
        code: "G2-01-03",
        name: "Site Survey Report",
        description: "Completed site survey — location, ground conditions, access, existing utilities, and constraints.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G2-01-04",
        name: "Equipment Selection",
        description: "Equipment specification matrix — manufacturer, model, quantity, specs, unit costs, and lead times.",
        isRequired: true,
        sortOrder: 40,
      },
      {
        code: "G2-02",
        name: "Drawing Master List",
        description: "Register of all technical drawings — drawing numbers, titles, revision status, and approval state.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G2-03",
        name: "Equipment Freeze List",
        description: "Locked and approved equipment list. No changes to this list without formal change control after Gate 2.",
        isRequired: true,
        sortOrder: 60,
      },
      {
        code: "G2-04",
        name: "Interface & Responsibility Matrix",
        description: "RACI matrix defining system interfaces and responsibility assignments across all parties.",
        isRequired: true,
        sortOrder: 70,
      },
      {
        code: "G2-05",
        name: "Updated Baseline Cost",
        description: "Revised budget after design freeze — reflects actual equipment selections and updated cost estimates.",
        isRequired: true,
        sortOrder: 80,
      },
      {
        code: "G2-MT",
        name: "Gate 2 Master Tracking",
        description: "Consolidated Gate 2 status tracker — deliverable completion, open issues, and approval sign-offs.",
        isRequired: false,
        sortOrder: 90,
      },
    ],
  },

  // ─── Gate 3: Procurement Release ─────────────────────────────────────────────
  {
    gateNo: 3,
    gateName: "Procurement Release",
    deliverables: [
      {
        code: "G3-01",
        name: "Procurement Plan",
        description: "Procurement strategy — vendor shortlist, sourcing approach, and timeline for key equipment.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G3-02",
        name: "Issued Purchase Orders",
        description: "Confirmed POs issued to vendors for all major equipment, especially long-lead items.",
        isRequired: true,
        sortOrder: 20,
      },
      {
        code: "G3-03",
        name: "Delivery Schedule",
        description: "Vendor-confirmed delivery schedule aligned to site execution plan.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G3-04",
        name: "Import / Logistics Plan",
        description: "Customs, freight, and logistics plan for imported equipment (if applicable).",
        isRequired: false,
        sortOrder: 40,
      },
      {
        code: "G3-05",
        name: "HSE Plan",
        description: "Health, Safety & Environment plan — submitted and acknowledged before site mobilisation.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G3-06",
        name: "Permits & Approvals",
        description: "All required site permits, regulatory approvals, and authority consents.",
        isRequired: true,
        sortOrder: 60,
      },
      {
        code: "G3-07",
        name: "Subcontractor Agreements",
        description: "Signed subcontractor agreements and scope definitions (if applicable).",
        isRequired: false,
        sortOrder: 70,
      },
    ],
  },

  // ─── Gate 4: Site Execution ───────────────────────────────────────────────────
  {
    gateNo: 4,
    gateName: "Site Execution",
    deliverables: [
      {
        code: "G4-01",
        name: "Site Readiness Confirmation",
        description: "Signed confirmation that site is prepared and ready for mobilisation.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G4-02",
        name: "IFC Drawing Package",
        description: "Issue-for-Construction drawings — final, approved drawings issued to site team.",
        isRequired: true,
        sortOrder: 20,
      },
      {
        code: "G4-03",
        name: "Site Execution Plan",
        description: "Detailed construction/installation plan — methodology, schedule, resource allocation, and logistics.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G4-04",
        name: "Material Delivery & Installation Tracking",
        description: "Delivery logs and installation progress records — equipment received, inspected, and installed.",
        isRequired: true,
        sortOrder: 40,
      },
      {
        code: "G4-05",
        name: "Site Progress & Issue Reports",
        description: "Weekly/monthly site progress reports, issue logs, and corrective action records.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G4-06",
        name: "Site Change & Deviation Log",
        description: "Change control register — all deviations from plan, impact analysis, and client/PM approval.",
        isRequired: true,
        sortOrder: 60,
      },
    ],
  },

  // ─── Gate 5: Commissioning ────────────────────────────────────────────────────
  {
    gateNo: 5,
    gateName: "Commissioning",
    deliverables: [
      {
        code: "G5-01",
        name: "Commissioning Test Plan",
        description: "Approved commissioning test plan — test procedures, acceptance criteria, and responsibilities.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G5-02",
        name: "Factory Acceptance Test (FAT) Records",
        description: "Signed FAT test records for major equipment (if applicable).",
        isRequired: false,
        sortOrder: 20,
      },
      {
        code: "G5-03",
        name: "Site Acceptance Test (SAT) Records",
        description: "Completed SAT records — all functional and performance tests signed off.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G5-04",
        name: "As-Built Drawings",
        description: "Final as-built drawings reflecting the actual installed configuration.",
        isRequired: true,
        sortOrder: 40,
      },
      {
        code: "G5-05",
        name: "O&M Manual",
        description: "Operation & Maintenance manual issued to client.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G5-06",
        name: "Warranty Documentation",
        description: "Signed warranty certificates and records per installed equipment (serial level where possible).",
        isRequired: true,
        sortOrder: 60,
      },
      {
        code: "G5-07",
        name: "Client Acceptance Certificate",
        description: "Signed project completion / handover acceptance certificate from client.",
        isRequired: true,
        sortOrder: 70,
      },
      {
        code: "G5-08",
        name: "Punchlist Clearance Record",
        description: "Evidence that all critical punchlist items are closed or formally accepted by client.",
        isRequired: true,
        sortOrder: 80,
      },
    ],
  },

  // ─── Gate 6: Financial Close Out ──────────────────────────────────────────────
  {
    gateNo: 6,
    gateName: "Financial Close Out",
    deliverables: [
      {
        code: "G6-01",
        name: "Final Invoice",
        description: "Final project invoice issued to client.",
        isRequired: true,
        sortOrder: 10,
      },
      {
        code: "G6-02",
        name: "Payment Reconciliation",
        description: "Confirmation that all outstanding invoices are settled and accounts are cleared.",
        isRequired: true,
        sortOrder: 20,
      },
      {
        code: "G6-03",
        name: "Retention Release",
        description: "Documentation confirming retention release conditions are met and retention collected.",
        isRequired: true,
        sortOrder: 30,
      },
      {
        code: "G6-04",
        name: "Final Cost vs Budget Reconciliation",
        description: "Final cost-to-complete vs. baseline and updated budget — signed off by PM and Finance.",
        isRequired: true,
        sortOrder: 40,
      },
      {
        code: "G6-05",
        name: "Final Margin Record",
        description: "Actual project margin recorded and approved.",
        isRequired: true,
        sortOrder: 50,
      },
      {
        code: "G6-06",
        name: "Lessons Learned",
        description: "Documented lessons learned — what went well, what to improve, and recommendations.",
        isRequired: false,
        sortOrder: 60,
      },
      {
        code: "G6-07",
        name: "Project Archive",
        description: "Confirmation that all project documents are archived and the project record is complete.",
        isRequired: true,
        sortOrder: 70,
      },
    ],
  },
];

/** Returns a gate template by gate number (1–6). */
export function getGateTemplate(gateNo: number): GateTemplate | undefined {
  return GATE_TEMPLATES.find((g) => g.gateNo === gateNo);
}

/** Returns all deliverable templates for a given gate. */
export function getGateDeliverables(gateNo: number): GateDeliverableTemplate[] {
  return getGateTemplate(gateNo)?.deliverables ?? [];
}

/** Format a project number as P001, P002, etc. */
export function formatProjectNumber(n: number): string {
  return `P${String(n).padStart(3, "0")}`;
}
