"use strict";
// Shared TypeScript types across the Solaroo RE CRM monorepo
// Domain-specific types live alongside their respective Prisma models.
// This package is for shared utility types and API contract types.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_GATES = exports.OPPORTUNITY_STAGE_ORDER = void 0;
// ─── Opportunity Lifecycle ────────────────────────────────────────────────────
exports.OPPORTUNITY_STAGE_ORDER = [
    "LEAD",
    "QUALIFIED",
    "DATA_COLLECTION",
    "SITE_ASSESSMENT_PENDING",
    "CONCEPT_DESIGN",
    "BUDGETARY_PROPOSAL",
    "FIRM_PROPOSAL",
    "NEGOTIATION",
    "CONTRACTING",
    "WON",
];
// ─── Gate Numbers ─────────────────────────────────────────────────────────────
exports.PROJECT_GATES = {
    1: "Contract & Project Handover",
    2: "Design Freeze",
    3: "Procurement Release",
    4: "Site Execution",
    5: "Testing, Commissioning & Handover",
    6: "Financial Close-out",
};
