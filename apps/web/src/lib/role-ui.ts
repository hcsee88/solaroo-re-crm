/**
 * role-ui.ts — Role-based UI visibility configuration for Solaroo RE CRM V1
 *
 * Single source of truth for:
 *   - which sidebar nav items each role sees
 *   - which table columns are visible by role
 *   - which dashboard sections are visible by role
 *   - which sensitive fields are shown by role
 *
 * Design principle:
 *   Permission to access an endpoint ≠ permission to show every field.
 *   Default is restrictive. Show less, not more.
 *   Sensitive commercial data (margin, CAPEX, pipeline value) is hidden
 *   by default unless the role genuinely needs it for their day-to-day work.
 */

export type RoleName =
  | "SUPER_ADMIN"
  | "DIRECTOR"
  | "PMO_MANAGER"
  | "SALES_MANAGER"
  | "SALES_ENGINEER"
  | "PROJECT_MANAGER"
  | "DESIGN_LEAD"
  | "DESIGN_ENGINEER"
  | "PROCUREMENT"
  | "SITE_SUPERVISOR"
  | "COMMISSIONING_ENGINEER"
  | "OM_ENGINEER"
  | "FINANCE_ADMIN";

// ─── Sidebar nav visibility ───────────────────────────────────────────────────

export type NavHref =
  | "/dashboard"
  | "/accounts"
  | "/contacts"
  | "/sites"
  | "/opportunities"
  | "/proposals"
  | "/projects"
  | "/pmo"
  | "/procurement"
  | "/documents"
  | "/om"
  | "/reports";

/**
 * Ordered nav items per role.
 * Order here = order in the sidebar.
 * SUPER_ADMIN is empty — they see only the Admin section rendered separately.
 */
const NAV_BY_ROLE: Record<RoleName, NavHref[]> = {
  SUPER_ADMIN: [],

  DIRECTOR: [
    "/dashboard",
    "/accounts",
    "/contacts",
    "/sites",
    "/opportunities",
    "/proposals",
    "/projects",
    "/pmo",
    "/procurement",
    "/documents",
    "/om",
    "/reports",
  ],

  PMO_MANAGER: [
    "/dashboard",
    "/projects",
    "/pmo",
    "/documents",
    "/reports",
  ],

  SALES_MANAGER: [
    "/dashboard",
    "/accounts",
    "/contacts",
    "/sites",
    "/opportunities",
    "/proposals",
    "/documents",
    "/reports",
  ],

  SALES_ENGINEER: [
    "/dashboard",
    "/accounts",
    "/contacts",
    "/sites",
    "/opportunities",
    "/proposals",
    "/documents",
  ],

  PROJECT_MANAGER: [
    "/dashboard",
    "/projects",
    "/pmo",
    "/documents",
    "/reports",
  ],

  DESIGN_LEAD: [
    "/dashboard",
    "/opportunities",
    "/proposals",
    "/projects",
    "/documents",
    "/pmo",
    "/reports",
  ],

  DESIGN_ENGINEER: [
    "/dashboard",
    "/opportunities",
    "/projects",
    "/documents",
  ],

  PROCUREMENT: [
    "/dashboard",
    "/projects",
    "/procurement",
    "/documents",
  ],

  SITE_SUPERVISOR: [
    "/dashboard",
    "/projects",
    "/documents",
    "/om",
  ],

  COMMISSIONING_ENGINEER: [
    "/dashboard",
    "/projects",
    "/documents",
    "/om",
  ],

  OM_ENGINEER: [
    "/dashboard",
    "/om",
    "/projects",
    "/documents",
  ],

  FINANCE_ADMIN: [
    "/dashboard",
    "/reports",
    "/projects",
    "/documents",
  ],
};

/** Returns the ordered nav hrefs visible to a given role. Falls back to empty. */
export function getNavItemsForRole(roleName: string): NavHref[] {
  return NAV_BY_ROLE[roleName as RoleName] ?? [];
}

// ─── Proposals list — column visibility ──────────────────────────────────────
//
// CAPEX and Margin are the two most commercially sensitive columns.
// - Margin is shown only to roles whose primary job involves commercial decisions.
// - CAPEX is slightly less sensitive but still restricted to commercial/finance roles.
// - Design and execution roles see the proposal workflow, not the numbers.

const ROLES_SEE_PROPOSAL_CAPEX = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "FINANCE_ADMIN",
]);

const ROLES_SEE_PROPOSAL_MARGIN = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "FINANCE_ADMIN",
]);

export function canSeeProposalCapex(roleName: string): boolean {
  return ROLES_SEE_PROPOSAL_CAPEX.has(roleName as RoleName);
}

export function canSeeProposalMargin(roleName: string): boolean {
  return ROLES_SEE_PROPOSAL_MARGIN.has(roleName as RoleName);
}

// ─── Opportunities list — column visibility ───────────────────────────────────
//
// Estimated deal value is relevant to sales and finance roles.
// Execution roles (Project, Design, Site, Procurement, O&M) work with
// the project once it's won — they don't need to see pipeline values.

const ROLES_SEE_OPPORTUNITY_VALUE = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "SALES_ENGINEER",
  "FINANCE_ADMIN",
]);

export function canSeeOpportunityValue(roleName: string): boolean {
  return ROLES_SEE_OPPORTUNITY_VALUE.has(roleName as RoleName);
}

// ─── Dashboard — section visibility ──────────────────────────────────────────
//
// The dashboard reuses a single /reporting/dashboard API response.
// Different roles see different sections rendered from the same data.
// This avoids building separate dashboards while still giving each role
// a workspace appropriate to their focus.

/** Pipeline Health section — sales-oriented. Not useful for execution roles. */
const ROLES_SEE_PIPELINE_SECTION = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "SALES_ENGINEER",
]);

/** Pipeline Value figure inside the pipeline section. Most commercially sensitive. */
const ROLES_SEE_PIPELINE_VALUE = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
]);

/** Proposal Status section — relevant to approvers and sales. */
const ROLES_SEE_PROPOSAL_SECTION = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "SALES_ENGINEER",
  "DESIGN_LEAD",
  "FINANCE_ADMIN",
]);

/** Active Accounts quick-count card — not useful for execution/O&M roles. */
const ROLES_SEE_ACCOUNTS_COUNT = new Set<RoleName>([
  "DIRECTOR",
  "SALES_MANAGER",
  "SALES_ENGINEER",
  "FINANCE_ADMIN",
]);

export function canSeePipelineSection(roleName: string): boolean {
  return ROLES_SEE_PIPELINE_SECTION.has(roleName as RoleName);
}

export function canSeePipelineValue(roleName: string): boolean {
  return ROLES_SEE_PIPELINE_VALUE.has(roleName as RoleName);
}

export function canSeeProposalSection(roleName: string): boolean {
  return ROLES_SEE_PROPOSAL_SECTION.has(roleName as RoleName);
}

export function canSeeAccountsCount(roleName: string): boolean {
  return ROLES_SEE_ACCOUNTS_COUNT.has(roleName as RoleName);
}
