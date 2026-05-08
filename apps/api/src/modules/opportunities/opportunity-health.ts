// Pure helpers — no DB, no IO. Used by OpportunitiesService and ReportingService.

export type OpportunityHealth = 'HEALTHY' | 'AT_RISK' | 'STALE' | 'OVERDUE';

export type EffectiveNextActionStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'NONE';

// V1 health thresholds — see docs/opportunity-health-rules.md
//   AT_RISK if no activity in > 7 days
//   STALE   if no activity in > 14 days
//   OVERDUE if next-action due date has passed (highest priority)
const AT_RISK_DAYS = 7;
const STALE_DAYS   = 14;

/**
 * Compute the four-state health of an opportunity from its activity recency
 * and next-action state. Order matters: OVERDUE > STALE > AT_RISK > HEALTHY.
 */
export function computeOpportunityHealth(input: {
  stage: string;                         // current stage
  nextAction: string | null | undefined;
  nextActionDueDate: Date | null | undefined;
  nextActionStatus: 'PENDING' | 'COMPLETED' | 'CANCELLED' | null | undefined;
  lastActivityAt: Date | null | undefined;
  now?: Date;
}): OpportunityHealth {
  const now = input.now ?? new Date();
  // Terminal stages → always HEALTHY (no follow-up needed)
  if (input.stage === 'WON' || input.stage === 'LOST' || input.stage === 'ON_HOLD') {
    return 'HEALTHY';
  }

  // OVERDUE — open action (not COMPLETED, not CANCELLED) whose due date has passed.
  // Highest priority — wins over STALE / AT_RISK.
  const isOpenAction =
    input.nextActionStatus !== 'COMPLETED' && input.nextActionStatus !== 'CANCELLED';
  if (
    isOpenAction &&
    input.nextActionDueDate &&
    input.nextActionDueDate.getTime() < now.getTime()
  ) {
    return 'OVERDUE';
  }

  const ageDays = input.lastActivityAt
    ? (now.getTime() - input.lastActivityAt.getTime()) / 86_400_000
    : Infinity;
  if (ageDays > STALE_DAYS)   return 'STALE';
  if (ageDays > AT_RISK_DAYS) return 'AT_RISK';

  // No next action recorded at all (and recent activity) → still AT_RISK
  if (!input.nextAction || input.nextAction.trim() === '') return 'AT_RISK';

  return 'HEALTHY';
}

/** Effective next-action status (computed). Adds OVERDUE/NONE on top of the stored value. */
export function computeNextActionStatus(input: {
  nextAction: string | null | undefined;
  nextActionDueDate: Date | null | undefined;
  nextActionStatus: 'PENDING' | 'COMPLETED' | 'CANCELLED' | null | undefined;
  now?: Date;
}): EffectiveNextActionStatus {
  if (!input.nextAction || input.nextAction.trim() === '') return 'NONE';
  if (input.nextActionStatus === 'COMPLETED') return 'COMPLETED';
  if (input.nextActionStatus === 'CANCELLED') return 'NONE';
  const now = input.now ?? new Date();
  if (input.nextActionDueDate && input.nextActionDueDate.getTime() < now.getTime()) {
    return 'OVERDUE';
  }
  return 'PENDING';
}

/** Date utilities for reporting filters. */
export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export function startOfQuarter(d: Date = new Date()): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
export function endOfQuarter(d: Date = new Date()): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
}
