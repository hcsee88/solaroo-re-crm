// Defines valid opportunity stage transitions.
// A stage can only move to stages listed in its `allowedNext` array.
// Terminal stages (WON, LOST) have no forward transitions.

import type { OpportunityStage } from "@solaroo/db";

type StageTransitionRule = {
  allowedNext: OpportunityStage[];
  requiresReason?: boolean;
};

export const OPPORTUNITY_STAGE_TRANSITIONS: Record<
  OpportunityStage,
  StageTransitionRule
> = {
  LEAD: {
    allowedNext: ["QUALIFIED", "LOST", "ON_HOLD"],
  },
  QUALIFIED: {
    allowedNext: ["DATA_COLLECTION", "LOST", "ON_HOLD"],
  },
  DATA_COLLECTION: {
    allowedNext: ["SITE_ASSESSMENT_PENDING", "LOST", "ON_HOLD"],
  },
  SITE_ASSESSMENT_PENDING: {
    allowedNext: ["CONCEPT_DESIGN", "LOST", "ON_HOLD"],
  },
  CONCEPT_DESIGN: {
    allowedNext: ["BUDGETARY_PROPOSAL", "FIRM_PROPOSAL", "LOST", "ON_HOLD"],
  },
  BUDGETARY_PROPOSAL: {
    allowedNext: ["FIRM_PROPOSAL", "NEGOTIATION", "LOST", "ON_HOLD"],
  },
  FIRM_PROPOSAL: {
    allowedNext: ["NEGOTIATION", "LOST", "ON_HOLD"],
  },
  NEGOTIATION: {
    allowedNext: ["CONTRACTING", "LOST", "ON_HOLD"],
  },
  CONTRACTING: {
    allowedNext: ["WON", "LOST", "ON_HOLD"],
  },
  WON: {
    allowedNext: [], // terminal — project is created
  },
  LOST: {
    allowedNext: ["LEAD"], // can re-open a lost opportunity
    requiresReason: true,
  },
  ON_HOLD: {
    allowedNext: ["LEAD", "QUALIFIED", "DATA_COLLECTION", "LOST"],
  },
};

export function canTransitionStage(
  from: OpportunityStage,
  to: OpportunityStage
): boolean {
  const rule = OPPORTUNITY_STAGE_TRANSITIONS[from];
  return rule.allowedNext.includes(to);
}

export function assertValidTransition(
  from: OpportunityStage,
  to: OpportunityStage
): void {
  if (!canTransitionStage(from, to)) {
    throw new Error(
      `Invalid stage transition: ${from} → ${to}. Allowed: ${OPPORTUNITY_STAGE_TRANSITIONS[from].allowedNext.join(", ") || "none"}`
    );
  }
}
