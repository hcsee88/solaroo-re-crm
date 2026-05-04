// Shared TypeScript types across the Solaroo RE CRM monorepo
// Domain-specific types live alongside their respective Prisma models.
// This package is for shared utility types and API contract types.

export * from './permissions';

// ─── API Response Envelope ────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

// ─── Sort / Filter ────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export type SortParams = {
  sortBy?: string;
  sortDir?: SortDirection;
};

// ─── Common ───────────────────────────────────────────────────────────────────

export type UserContext = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
};

// ─── Opportunity Lifecycle ────────────────────────────────────────────────────

export const OPPORTUNITY_STAGE_ORDER = [
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
] as const;

export type OpportunityStageValue = typeof OPPORTUNITY_STAGE_ORDER[number] | "LOST" | "ON_HOLD";

// ─── Gate Numbers ─────────────────────────────────────────────────────────────

export const PROJECT_GATES = {
  1: "Contract & Project Handover",
  2: "Design Freeze",
  3: "Procurement Release",
  4: "Site Execution",
  5: "Testing, Commissioning & Handover",
  6: "Financial Close-out",
} as const;

export type GateNumber = keyof typeof PROJECT_GATES;

// ─── Account types ────────────────────────────────────────────────────────────

export type AccountType = 'CLIENT' | 'PROSPECT' | 'PARTNER' | 'CONSULTANT' | 'VENDOR';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CLIENT: 'Client',
  PROSPECT: 'Prospect',
  PARTNER: 'Partner',
  CONSULTANT: 'Consultant',
  VENDOR: 'Vendor',
};

export const ACCOUNT_TYPE_COLOURS: Record<AccountType, string> = {
  CLIENT:     'bg-solar-100 text-solar-800',
  PROSPECT:   'bg-blue-100 text-blue-800',
  PARTNER:    'bg-purple-100 text-purple-800',
  CONSULTANT: 'bg-amber-100 text-amber-800',
  VENDOR:     'bg-gray-100 text-gray-700',
};

export type AccountListItem = {
  id: string;
  accountCode: string;
  name: string;
  type: AccountType;
  industry: string | null;
  region: string | null;
  country: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    contacts: number;
    sites: number;
    opportunities: number;
  };
};

export type AccountDetail = {
  id: string;
  accountCode: string;
  name: string;
  type: AccountType;
  industry: string | null;
  registrationNo: string | null;
  country: string;
  region: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    contacts: number;
    sites: number;
    opportunities: number;
    projects: number;
  };
};

export type CreateAccountInput = {
  name: string;
  type: AccountType;
  industry?: string;
  registrationNo?: string;
  country?: string;
  region?: string;
  website?: string;
  notes?: string;
};

// ─── Contact types ────────────────────────────────────────────────────────────

export type ContactAccountLink = {
  isPrimary: boolean;
  relationship: string | null;
  account: {
    id: string;
    accountCode: string;
    name: string;
  };
};

export type ContactListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  accounts: ContactAccountLink[];
};

export type ContactDetail = ContactListItem & {
  notes: string | null;
  updatedAt: string;
};

// ─── Site types ───────────────────────────────────────────────────────────────

export type SiteGridCategory = 'OFF_GRID' | 'WEAK_GRID' | 'GRID_CONNECTED' | 'HYBRID';

export const SITE_GRID_CATEGORY_LABELS: Record<SiteGridCategory, string> = {
  OFF_GRID: 'Off-Grid',
  WEAK_GRID: 'Weak Grid',
  GRID_CONNECTED: 'Grid-Connected',
  HYBRID: 'Hybrid',
};

export const SITE_GRID_CATEGORY_COLOURS: Record<SiteGridCategory, string> = {
  OFF_GRID:       'bg-orange-100 text-orange-800',
  WEAK_GRID:      'bg-yellow-100 text-yellow-800',
  GRID_CONNECTED: 'bg-green-100 text-green-800',
  HYBRID:         'bg-blue-100 text-blue-800',
};

export type SiteListItem = {
  id: string;
  siteCode: string;
  name: string;
  gridCategory: SiteGridCategory;
  region: string | null;
  country: string;
  isActive: boolean;
  createdAt: string;
  account: {
    id: string;
    accountCode: string;
    name: string;
  };
  _count: {
    opportunities: number;
    projects: number;
    assets: number;
  };
};

// ─── Opportunity types ────────────────────────────────────────────────────────

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStageValue, string> = {
  LEAD:                   'Lead',
  QUALIFIED:              'Qualified',
  DATA_COLLECTION:        'Data Collection',
  SITE_ASSESSMENT_PENDING:'Site Assessment',
  CONCEPT_DESIGN:         'Concept Design',
  BUDGETARY_PROPOSAL:     'Budgetary Proposal',
  FIRM_PROPOSAL:          'Firm Proposal',
  NEGOTIATION:            'Negotiation',
  CONTRACTING:            'Contracting',
  WON:                    'Won',
  LOST:                   'Lost',
  ON_HOLD:                'On Hold',
};

export const OPPORTUNITY_STAGE_COLOURS: Record<OpportunityStageValue, string> = {
  LEAD:                   'bg-gray-100 text-gray-700',
  QUALIFIED:              'bg-blue-100 text-blue-800',
  DATA_COLLECTION:        'bg-indigo-100 text-indigo-800',
  SITE_ASSESSMENT_PENDING:'bg-purple-100 text-purple-800',
  CONCEPT_DESIGN:         'bg-violet-100 text-violet-800',
  BUDGETARY_PROPOSAL:     'bg-orange-100 text-orange-800',
  FIRM_PROPOSAL:          'bg-amber-100 text-amber-800',
  NEGOTIATION:            'bg-yellow-100 text-yellow-800',
  CONTRACTING:            'bg-solar-100 text-solar-800',
  WON:                    'bg-green-100 text-green-800',
  LOST:                   'bg-red-100 text-red-800',
  ON_HOLD:                'bg-gray-200 text-gray-600',
};

export const COMMERCIAL_MODEL_LABELS: Record<string, string> = {
  CAPEX_SALE:       'CAPEX Sale',
  LEASE:            'Lease',
  PPA:              'PPA',
  HYBRID_CAPEX_PPA: 'Hybrid CAPEX+PPA',
  EPC_ONLY:         'EPC Only',
  DESIGN_AND_SUPPLY:'Design & Supply',
};

export type OpportunityStageHistory = {
  id: string;
  fromStage: OpportunityStageValue | null;
  toStage: OpportunityStageValue;
  reason: string | null;
  changedAt: string;
};

// V1 sales pipeline computed fields shared by list + detail
export type OpportunityHealth = 'HEALTHY' | 'AT_RISK' | 'STALE' | 'OVERDUE';
export type EffectiveNextActionStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'NONE';
export type NextActionTypeValue =
  | 'FOLLOW_UP' | 'SITE_SURVEY' | 'REVISED_QUOTATION'
  | 'CLIENT_MEETING' | 'INTERNAL_REVIEW' | 'OTHER';

export type OpportunityListItem = {
  id: string;
  opportunityCode: string;
  title: string;
  stage: OpportunityStageValue;
  commercialModel: string | null;
  estimatedValue: string | null;
  probabilityPercent: number | null;
  expectedAwardDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  nextAction: string | null;
  nextActionDueDate: string | null;
  // V1 structured next-action fields
  nextActionType: NextActionTypeValue | null;
  nextActionStatus: 'PENDING' | 'COMPLETED';
  nextActionOwnerId: string | null;
  // V1 computed fields
  lastActivityAt: string | null;
  health: OpportunityHealth;
  effectiveNextActionStatus: EffectiveNextActionStatus;
  account: { id: string; accountCode: string; name: string };
  site: { id: string; siteCode: string; name: string; gridCategory: string };
  owner: { id: string; name: string; email: string };
  designEngineerId: string | null;
  designEngineer: { id: string; name: string; email: string } | null;
  _count: { proposals: number; activities?: number };
};

export type OpportunityDetail = OpportunityListItem & {
  estimatedPvKwp: string | null;
  estimatedBessKw: string | null;
  estimatedBessKwh: string | null;
  summary: string | null;
  risks: string | null;
  competitors: string | null;
  lostReason: string | null;
  accountId: string;
  siteId: string;
  ownerUserId: string;
  nextAction: string | null;
  nextActionDueDate: string | null;
  nextActionCompletedAt: string | null;
  lastStatusNote: string | null;
  stageHistory: OpportunityStageHistory[];
  allowedNextStages: OpportunityStageValue[];
};

export type SiteDetail = {
  id: string;
  siteCode: string;
  name: string;
  gridCategory: SiteGridCategory;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  country: string;
  region: string | null;
  operatingSchedule: string | null;
  accessConstraints: string | null;
  safetyConstraints: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountId: string;
  account: {
    id: string;
    accountCode: string;
    name: string;
  };
  primaryContactId: string | null;
  primaryContact: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  _count: {
    opportunities: number;
    projects: number;
    assets: number;
  };
};
