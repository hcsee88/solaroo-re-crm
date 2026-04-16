import type { Resource, Action } from '@solaroo/types';

// Fields that require an explicit permission check before being returned to the client.
// If a user lacks the required permission, the field is stripped from the response.
//
// Field names MUST match the actual keys present in API response objects.
// Proposal commercial fields:  marginPercent | estimatedMargin | estimatedCapex
// Project cost fields:         budgetBaseline | actualCostToDate | marginBaseline
export type SensitiveField =
  | 'marginPercent'       // proposal version: margin %
  | 'estimatedMargin'     // proposal version: margin RM value
  | 'estimatedCapex'      // proposal version: total capex estimate
  | 'actualMarginPct'     // project: actual margin % (post-contract)
  | 'actualMarginValue'   // project: actual margin RM (post-contract)
  | 'contractValue'       // contract: agreed contract value
  | 'budgetBaseline'      // project: approved budget baseline
  | 'actualCostToDate'    // project: cost-to-date
  | 'marginBaseline'      // project: margin baseline
  | 'paymentStatus';      // invoice milestone: payment status

export const SENSITIVE_FIELD_POLICY: Record<
  SensitiveField,
  { resource: Resource; action: Action }
> = {
  marginPercent:    { resource: 'margin',         action: 'view_estimated' },
  estimatedMargin:  { resource: 'margin',         action: 'view_estimated' },
  estimatedCapex:   { resource: 'margin',         action: 'view_estimated' },
  actualMarginPct:  { resource: 'margin',         action: 'view_actual' },
  actualMarginValue:{ resource: 'margin',         action: 'view_actual' },
  contractValue:    { resource: 'contract',       action: 'view_value' },
  budgetBaseline:   { resource: 'cost',           action: 'view' },
  actualCostToDate: { resource: 'cost',           action: 'view' },
  marginBaseline:   { resource: 'cost',           action: 'view' },
  paymentStatus:    { resource: 'payment_status', action: 'view' },
};
