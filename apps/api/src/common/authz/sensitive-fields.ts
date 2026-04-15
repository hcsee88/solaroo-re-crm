import type { Resource, Action } from '@solaroo/types';

// Fields that require an explicit permission check before being returned to the client.
// If a user lacks the required permission, the field is stripped from the response.
export type SensitiveField =
  | 'estimatedMarginPct'
  | 'estimatedMarginValue'
  | 'actualMarginPct'
  | 'actualMarginValue'
  | 'contractValue'
  | 'costBudget'
  | 'actualCostToDate'
  | 'paymentStatus';

export const SENSITIVE_FIELD_POLICY: Record<
  SensitiveField,
  { resource: Resource; action: Action }
> = {
  estimatedMarginPct:   { resource: 'margin',         action: 'view_estimated' },
  estimatedMarginValue: { resource: 'margin',         action: 'view_estimated' },
  actualMarginPct:      { resource: 'margin',         action: 'view_actual' },
  actualMarginValue:    { resource: 'margin',         action: 'view_actual' },
  contractValue:        { resource: 'contract',       action: 'view_value' },
  costBudget:           { resource: 'cost',           action: 'view' },
  actualCostToDate:     { resource: 'cost',           action: 'view' },
  paymentStatus:        { resource: 'payment_status', action: 'view' },
};
