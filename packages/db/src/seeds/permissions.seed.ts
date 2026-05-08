import type { PrismaClient } from '@prisma/client';

// Permission seed definition: resource:action:scope → roles that receive it
// Roles map to the 10 seeded role names.
// Scope: "own" | "team" | "assigned" | "all"

type PermissionDef = {
  resource: string;
  action: string;
  scope: string;
  roles: string[];
};

export const PERMISSION_DEFS: PermissionDef[] = [
  // ─── Accounts ──────────────────────────────────────────────────────────────
  { resource: 'account', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'PROJECT_MANAGER', 'DESIGN_LEAD', 'DESIGN_ENGINEER', 'PROCUREMENT', 'FINANCE_ADMIN'] },
  { resource: 'account', action: 'view',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'account', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'account', action: 'create', scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'account', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'account', action: 'edit',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'account', action: 'delete', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'account', action: 'export', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },

  // ─── Contacts ──────────────────────────────────────────────────────────────
  { resource: 'contact', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'contact', action: 'view',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'contact', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'contact', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'contact', action: 'create', scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'contact', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'contact', action: 'edit',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'contact', action: 'delete', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },

  // ─── Sites ─────────────────────────────────────────────────────────────────
  { resource: 'site', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'site', action: 'view',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'PROCUREMENT', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'site', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'site', action: 'create', scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'site', action: 'edit',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site', action: 'delete', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'site', action: 'export', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },

  // ─── Opportunities ─────────────────────────────────────────────────────────
  { resource: 'opportunity', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'opportunity', action: 'view',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'opportunity', action: 'view',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'opportunity', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'opportunity', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'opportunity', action: 'create',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'opportunity', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'opportunity', action: 'edit',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'opportunity', action: 'edit',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'opportunity', action: 'delete',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'opportunity', action: 'submit',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'opportunity', action: 'submit',  scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'opportunity', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'opportunity', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'opportunity', action: 'export',  scope: 'own',      roles: ['SALES_ENGINEER'] },

  // ─── Site & Technical Assessments ─────────────────────────────────────────
  { resource: 'site_assessment', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'site_assessment', action: 'view',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site_assessment', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'DESIGN_ENGINEER'] },
  { resource: 'site_assessment', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'site_assessment', action: 'create', scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site_assessment', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'site_assessment', action: 'edit',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'site_assessment', action: 'edit',   scope: 'assigned', roles: ['DESIGN_ENGINEER'] },

  { resource: 'technical_assessment', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'view',   scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'technical_assessment', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'DESIGN_ENGINEER', 'SALES_ENGINEER'] },
  { resource: 'technical_assessment', action: 'create', scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'edit',   scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'submit', scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'technical_assessment', action: 'approve', scope: 'all',     roles: ['DIRECTOR', 'DESIGN_LEAD'] },

  // ─── Proposals ─────────────────────────────────────────────────────────────
  { resource: 'proposal', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'proposal', action: 'view',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal', action: 'view',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'proposal', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'proposal', action: 'create',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'proposal', action: 'edit',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal', action: 'edit',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal', action: 'delete',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'proposal', action: 'submit',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal', action: 'submit',  scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'proposal', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'proposal', action: 'export',  scope: 'own',      roles: ['SALES_ENGINEER'] },

  { resource: 'proposal_version', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'proposal_version', action: 'view',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal_version', action: 'view',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal_version', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'proposal_version', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'proposal_version', action: 'create',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal_version', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'proposal_version', action: 'edit',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal_version', action: 'edit',    scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal_version', action: 'submit',  scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'proposal_version', action: 'submit',  scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'proposal_version', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },

  // ─── Projects ──────────────────────────────────────────────────────────────
  { resource: 'project', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'project', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'PROCUREMENT', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'project', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'project', action: 'edit',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'project', action: 'edit',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'project', action: 'submit',  scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'project', action: 'approve', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'project', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'project', action: 'export',  scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'project', action: 'manage_members', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'project', action: 'manage_members', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  // ─── Gates & Milestones ────────────────────────────────────────────────────
  { resource: 'project_gate', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'project_gate', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'project_gate', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'project_gate', action: 'edit',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'project_gate', action: 'edit',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'project_gate', action: 'submit',  scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'project_gate', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'project_gate', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER', 'DESIGN_LEAD'] },

  { resource: 'milestone', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'milestone', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'milestone', action: 'create', scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'milestone', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'milestone', action: 'edit',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'milestone', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },

  // ─── Issues & Risks ────────────────────────────────────────────────────────
  { resource: 'issue', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'issue', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'SITE_SUPERVISOR'] },
  { resource: 'issue', action: 'create', scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'SITE_SUPERVISOR'] },
  { resource: 'issue', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'issue', action: 'edit',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'issue', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },

  { resource: 'risk', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'SALES_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'risk', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'risk', action: 'create', scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'risk', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'risk', action: 'edit',   scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'risk', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },

  // ─── Documents & Drawings ──────────────────────────────────────────────────
  { resource: 'document', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'document', action: 'view',    scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'document', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'PROCUREMENT', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'document', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'document', action: 'create',  scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'document', action: 'edit',    scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'document', action: 'edit',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'COMMISSIONING_ENGINEER'] },
  { resource: 'document', action: 'submit',  scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'COMMISSIONING_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'document', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'document', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'document', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'document', action: 'export',  scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },

  { resource: 'drawing', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'drawing', action: 'create',  scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'edit',    scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'edit',    scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'submit',  scope: 'assigned', roles: ['DESIGN_ENGINEER', 'DESIGN_LEAD'] },
  { resource: 'drawing', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'DESIGN_LEAD'] },

  // ─── Procurement ───────────────────────────────────────────────────────────
  { resource: 'vendor', action: 'view',   scope: 'all', roles: ['DIRECTOR', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_LEAD', 'DESIGN_ENGINEER', 'PROCUREMENT', 'FINANCE_ADMIN'] },
  { resource: 'vendor', action: 'create', scope: 'all', roles: ['DIRECTOR', 'PROCUREMENT'] },
  { resource: 'vendor', action: 'edit',   scope: 'all', roles: ['DIRECTOR', 'PROCUREMENT'] },

  { resource: 'rfq', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'rfq', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'DESIGN_LEAD', 'DESIGN_ENGINEER', 'PROCUREMENT'] },
  { resource: 'rfq', action: 'create',  scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'rfq', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'rfq', action: 'edit',    scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'rfq', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'rfq', action: 'submit',  scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'rfq', action: 'approve', scope: 'all',      roles: ['DIRECTOR'] },

  { resource: 'quote', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'quote', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'DESIGN_LEAD', 'DESIGN_ENGINEER', 'PROCUREMENT'] },
  { resource: 'quote', action: 'create', scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'quote', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'quote', action: 'edit',   scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'quote', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },

  { resource: 'purchase_order', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'purchase_order', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER', 'PROCUREMENT'] },
  { resource: 'purchase_order', action: 'create',  scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'purchase_order', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'purchase_order', action: 'edit',    scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'purchase_order', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'purchase_order', action: 'submit',  scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'purchase_order', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'purchase_order', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },

  { resource: 'delivery', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'delivery', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'PROCUREMENT', 'SITE_SUPERVISOR'] },
  { resource: 'delivery', action: 'create', scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'delivery', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'delivery', action: 'edit',   scope: 'assigned', roles: ['PROCUREMENT'] },
  { resource: 'delivery', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },

  // ─── Site Execution ────────────────────────────────────────────────────────
  { resource: 'site_log', action: 'view',   scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'site_log', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'site_log', action: 'create', scope: 'assigned', roles: ['SITE_SUPERVISOR'] },
  { resource: 'site_log', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'site_log', action: 'edit',   scope: 'assigned', roles: ['SITE_SUPERVISOR'] },
  { resource: 'site_log', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'site_log', action: 'export', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'site_log', action: 'export', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  { resource: 'checklist', action: 'view',   scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'checklist', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'checklist', action: 'create', scope: 'assigned', roles: ['SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'checklist', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'checklist', action: 'edit',   scope: 'assigned', roles: ['SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'checklist', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },

  { resource: 'punch_list', action: 'view',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'punch_list', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'punch_list', action: 'create',  scope: 'assigned', roles: ['SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'punch_list', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'punch_list', action: 'edit',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER'] },
  { resource: 'punch_list', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'punch_list', action: 'submit',  scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'punch_list', action: 'approve', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'punch_list', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  // ─── Commissioning / Handover ──────────────────────────────────────────────
  { resource: 'testing_sheet', action: 'view',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'testing_sheet', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'testing_sheet', action: 'create',  scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'testing_sheet', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'testing_sheet', action: 'edit',    scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'testing_sheet', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'testing_sheet', action: 'submit',  scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'testing_sheet', action: 'approve', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'testing_sheet', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  { resource: 'handover_doc', action: 'view',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'handover_doc', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'handover_doc', action: 'create',  scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'handover_doc', action: 'create',  scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'handover_doc', action: 'edit',    scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'handover_doc', action: 'edit',    scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'handover_doc', action: 'submit',  scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'handover_doc', action: 'approve', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'handover_doc', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  { resource: 'asset', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'asset', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'asset', action: 'create', scope: 'assigned', roles: ['COMMISSIONING_ENGINEER'] },
  { resource: 'asset', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'asset', action: 'edit',   scope: 'assigned', roles: ['COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'asset', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'asset', action: 'approve', scope: 'all',     roles: ['DIRECTOR'] },
  { resource: 'asset', action: 'approve', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  // ─── O&M ───────────────────────────────────────────────────────────────────
  { resource: 'maintenance_ticket', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'maintenance_ticket', action: 'view',   scope: 'assigned', roles: ['OM_ENGINEER'] },
  { resource: 'maintenance_ticket', action: 'create', scope: 'assigned', roles: ['OM_ENGINEER'] },
  { resource: 'maintenance_ticket', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'maintenance_ticket', action: 'edit',   scope: 'assigned', roles: ['OM_ENGINEER'] },
  { resource: 'maintenance_ticket', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'maintenance_ticket', action: 'approve', scope: 'all',     roles: ['DIRECTOR'] },

  { resource: 'warranty_record', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'warranty_record', action: 'view',   scope: 'assigned', roles: ['COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'warranty_record', action: 'create', scope: 'assigned', roles: ['COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'warranty_record', action: 'create', scope: 'all',      roles: ['DIRECTOR'] },
  { resource: 'warranty_record', action: 'edit',   scope: 'assigned', roles: ['OM_ENGINEER'] },
  { resource: 'warranty_record', action: 'edit',   scope: 'all',      roles: ['DIRECTOR'] },

  // ─── Contracts & Finance ───────────────────────────────────────────────────
  { resource: 'contract', action: 'view',        scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'contract', action: 'view',        scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'contract', action: 'view',        scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER'] },
  { resource: 'contract', action: 'view_value',  scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN', 'SALES_MANAGER', 'PMO_MANAGER'] },
  { resource: 'contract', action: 'create',      scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'contract', action: 'edit',        scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN', 'PMO_MANAGER'] },
  { resource: 'contract', action: 'edit',        scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'contract', action: 'approve',     scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'contract', action: 'handover',    scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER'] },
  { resource: 'contract', action: 'handover',    scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'contract', action: 'export',      scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },

  { resource: 'invoice_milestone', action: 'view',    scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'invoice_milestone', action: 'view',    scope: 'assigned', roles: ['PROJECT_MANAGER'] },
  { resource: 'invoice_milestone', action: 'create',  scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'invoice_milestone', action: 'edit',    scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'invoice_milestone', action: 'approve', scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'invoice_milestone', action: 'export',  scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },

  // ─── Sensitive pseudo-resources (field-level gates) ────────────────────────
  { resource: 'margin', action: 'view_estimated', scope: 'all',  roles: ['DIRECTOR', 'SALES_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'margin', action: 'view_estimated', scope: 'own',  roles: ['SALES_ENGINEER'] },
  { resource: 'margin', action: 'view_actual',    scope: 'all',  roles: ['DIRECTOR', 'FINANCE_ADMIN'] },

  { resource: 'cost', action: 'view', scope: 'all',      roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'cost', action: 'view', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  { resource: 'payment_status', action: 'view', scope: 'all', roles: ['DIRECTOR', 'FINANCE_ADMIN'] },
  { resource: 'payment_status', action: 'edit', scope: 'all', roles: ['DIRECTOR', 'FINANCE_ADMIN'] },

  // ─── Reporting ─────────────────────────────────────────────────────────────
  { resource: 'reporting', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'DESIGN_LEAD', 'FINANCE_ADMIN'] },
  { resource: 'reporting', action: 'view',   scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'reporting', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SALES_ENGINEER', 'DESIGN_ENGINEER', 'PROCUREMENT', 'SITE_SUPERVISOR', 'COMMISSIONING_ENGINEER', 'OM_ENGINEER'] },
  { resource: 'reporting', action: 'export', scope: 'all',      roles: ['DIRECTOR', 'PMO_MANAGER', 'FINANCE_ADMIN'] },
  { resource: 'reporting', action: 'export', scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'reporting', action: 'export', scope: 'assigned', roles: ['PROJECT_MANAGER'] },

  // ─── Admin (SUPER_ADMIN only — not DIRECTOR) ──────────────────────────────
  { resource: 'user_admin', action: 'view',   scope: 'all', roles: ['SUPER_ADMIN'] },
  { resource: 'user_admin', action: 'create', scope: 'all', roles: ['SUPER_ADMIN'] },
  { resource: 'user_admin', action: 'edit',   scope: 'all', roles: ['SUPER_ADMIN'] },
  { resource: 'user_admin', action: 'delete', scope: 'all', roles: ['SUPER_ADMIN'] },

  { resource: 'role_admin', action: 'view',   scope: 'all', roles: ['SUPER_ADMIN'] },
  { resource: 'role_admin', action: 'create', scope: 'all', roles: ['SUPER_ADMIN'] },
  { resource: 'role_admin', action: 'edit',   scope: 'all', roles: ['SUPER_ADMIN'] },

  // Audit log — read-only governance trail. Visible to SUPER_ADMIN + commercial/PMO leadership.
  { resource: 'audit_log', action: 'view', scope: 'all', roles: ['SUPER_ADMIN', 'DIRECTOR', 'PMO_MANAGER'] },

  // ─── Activities (manual sales touchpoints) ────────────────────────────────
  // Each activity carries an ownerUserId — service-layer scope filter handles 'own'
  { resource: 'activity', action: 'view',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER', 'FINANCE_ADMIN', 'PMO_MANAGER'] },
  { resource: 'activity', action: 'view',   scope: 'team',     roles: ['SALES_MANAGER'] },
  { resource: 'activity', action: 'view',   scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'activity', action: 'view',   scope: 'assigned', roles: ['PROJECT_MANAGER', 'PROJECT_ENGINEER', 'DESIGN_ENGINEER'] },
  { resource: 'activity', action: 'create', scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'activity', action: 'create', scope: 'own',      roles: ['SALES_ENGINEER'] },
  { resource: 'activity', action: 'edit',   scope: 'all',      roles: ['DIRECTOR', 'SALES_MANAGER'] },
  { resource: 'activity', action: 'edit',   scope: 'own',      roles: ['SALES_ENGINEER'] },
];

export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  console.log('Seeding permissions...');

  let permCount = 0;
  let rpCount = 0;
  const expectedRolePermissionKeys = new Set<string>();
  const managedRoleNames = new Set<string>();

  for (const def of PERMISSION_DEFS) {
    // Upsert the permission record
    const permission = await prisma.permission.upsert({
      where: {
        resource_action_scope: {
          resource: def.resource,
          action: def.action,
          scope: def.scope,
        },
      },
      update: {},
      create: {
        resource: def.resource,
        action: def.action,
        scope: def.scope,
      },
    });
    permCount++;

    // Attach to each specified role
    for (const roleName of def.roles) {
      managedRoleNames.add(roleName);
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        console.warn(`  ⚠ Role not found: ${roleName} — skipping`);
        continue;
      }

      expectedRolePermissionKeys.add(`${role.id}:${permission.id}`);

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      rpCount++;
    }
  }

  // Remove stale seeded links so tightened role definitions take effect after a
  // reseed. Without this, old grants remain attached indefinitely.
  const managedRoles = await prisma.role.findMany({
    where: { name: { in: Array.from(managedRoleNames) } },
    select: { id: true },
  });

  const existingLinks = await prisma.rolePermission.findMany({
    where: { roleId: { in: managedRoles.map((role) => role.id) } },
    select: { roleId: true, permissionId: true },
  });

  const staleLinks = existingLinks.filter(
    (link) => !expectedRolePermissionKeys.has(`${link.roleId}:${link.permissionId}`),
  );

  if (staleLinks.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        OR: staleLinks.map((link) => ({
          roleId: link.roleId,
          permissionId: link.permissionId,
        })),
      },
    });
  }

  console.log(
    `✓ ${permCount} permissions seeded, ${rpCount} role-permission links created, ${staleLinks.length} stale links removed`,
  );
}
