// Permission vocabulary — used across API guards and service-layer checks.
// Never check role names directly in application logic; always check permissions.

export const RESOURCES = [
  // CRM
  'account', 'contact', 'site',
  // Sales pipeline
  'opportunity', 'site_assessment', 'technical_assessment',
  // Proposals
  'proposal', 'proposal_version',
  // Projects
  'project', 'project_gate', 'milestone', 'issue', 'risk', 'document',
  'drawing',
  // Procurement
  'vendor', 'rfq', 'quote', 'purchase_order', 'delivery',
  // Site execution
  'site_log', 'checklist', 'punch_list',
  // Commissioning / handover
  'testing_sheet', 'handover_doc', 'asset',
  // O&M
  'maintenance_ticket', 'warranty_record',
  // Finance
  'contract', 'invoice_milestone',
  // Sensitive pseudo-resources (field-level gates)
  'margin', 'cost', 'payment_status',
  // Admin
  'reporting', 'user_admin', 'role_admin', 'audit_log',
] as const;

export const ACTIONS = [
  'view', 'create', 'edit', 'delete', 'submit', 'approve', 'export',
  // Project team management — add/remove ProjectMember rows
  'manage_members',
  // Contract handover workflow — mark ready / begin / checklist / complete
  'handover',
  // Sensitive sub-actions on pseudo-resources
  'view_estimated', // margin — Sales Manager / Sales Engineer
  'view_actual',    // margin — Director / Finance only
  'view_value',     // contract value — Director / Finance / Sales Manager
] as const;

export const SCOPES = ['own', 'team', 'assigned', 'all'] as const;

export type Resource = typeof RESOURCES[number];
export type Action   = typeof ACTIONS[number];
export type Scope    = typeof SCOPES[number];

export type PermissionKey = `${Resource}:${Action}:${Scope}`;
