// Pure helpers — no DB, no IO. Used by OpportunitiesService and ReportingService.

// Sales Pipeline Lite (2026-05-08): 3-state health.
// AT_RISK was removed — it created noise without adding actionable signal.
// See docs/opportunity-health-rules.md and docs/sales-pipeline-lite.md.
export type OpportunityHealth = 'HEALTHY' | 'STALE' | 'OVERDUE';

export type EffectiveNextActionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'NONE';

// Lite threshold: no activity for > 30 days = STALE.
// Worker may apply a stage-specific shorter nudge (proposal stages → 7 days)
// for proactive notifications, but the health pill itself uses a uniform 30d.
const STALE_DAYS = 30;

/**
 * Compute the three-state health of an opportunity from its activity recency
 * and next-action state. Order matters: OVERDUE > STALE > HEALTHY.
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
  // Highest priority.
  const isOpenAction =
    input.nextActionStatus !== 'COMPLETED' && input.nextActionStatus !== 'CANCELLED';
  if (
    isOpenAction &&
    input.nextActionDueDate &&
    input.nextActionDueDate.getTime() < now.getTime()
  ) {
    return 'OVERDUE';
  }

  // STALE — no activity in > 30 days
  const ageDays = input.lastActivityAt
    ? (now.getTime() - input.lastActivityAt.getTime()) / 86_400_000
    : Infinity;
  if (ageDays > STALE_DAYS) return 'STALE';

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
