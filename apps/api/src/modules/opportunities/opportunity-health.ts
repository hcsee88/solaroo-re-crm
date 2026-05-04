// Pure helpers — no DB, no IO. Used by OpportunitiesService and ReportingService.

export type OpportunityHealth = 'HEALTHY' | 'AT_RISK' | 'STALE' | 'OVERDUE';

export type EffectiveNextActionStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'NONE';

/**
 * Compute the four-state health of an opportunity from its activity recency
 * and next-action state. Order matters: OVERDUE wins over STALE, STALE wins
 * over AT_RISK.
 */
export function computeOpportunityHealth(input: {
  stage: string;                         // current stage
  nextAction: string | null | undefined;
  nextActionDueDate: Date | null | undefined;
  nextActionStatus: 'PENDING' | 'COMPLETED' | null | undefined;
  lastActivityAt: Date | null | undefined;
  now?: Date;
}): OpportunityHealth {
  const now = input.now ?? new Date();
  // Terminal stages → always HEALTHY (no follow-up needed)
  if (input.stage === 'WON' || input.stage === 'LOST' || input.stage === 'ON_HOLD') {
    return 'HEALTHY';
  }

  // OVERDUE — pending action whose due date has passed
  if (
    input.nextActionStatus === 'PENDING' &&
    input.nextActionDueDate &&
    input.nextActionDueDate.getTime() < now.getTime()
  ) {
    return 'OVERDUE';
  }

  // STALE — no activity in 30 days
  const ageDays = input.lastActivityAt
    ? (now.getTime() - input.lastActivityAt.getTime()) / 86_400_000
    : Infinity;
  if (ageDays > 30) return 'STALE';
  if (ageDays > 14) return 'AT_RISK';

  // No next action recorded at all (and not stale)
  if (!input.nextAction || input.nextAction.trim() === '') return 'AT_RISK';

  return 'HEALTHY';
}

/** Effective next-action status (computed). Adds OVERDUE/NONE on top of the stored value. */
export function computeNextActionStatus(input: {
  nextAction: string | null | undefined;
  nextActionDueDate: Date | null | undefined;
  nextActionStatus: 'PENDING' | 'COMPLETED' | null | undefined;
  now?: Date;
}): EffectiveNextActionStatus {
  if (!input.nextAction || input.nextAction.trim() === '') return 'NONE';
  if (input.nextActionStatus === 'COMPLETED') return 'COMPLETED';
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
