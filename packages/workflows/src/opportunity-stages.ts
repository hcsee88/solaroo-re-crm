// Defines valid opportunity stage transitions.
// Active pipeline stages allow free movement to any other stage (forward, backward, or to terminal).
// This lets sales and directors fast-track deals or correct stage without friction.
// WON is terminal (project created on entry). LOST requires a reason.

import type { OpportunityStage } from "@solaroo/db";

type StageTransitionRule = {
  allowedNext: OpportunityStage[];
  requiresReason?: boolean;
};

// All active (non-terminal) pipeline stages
const PIPELINE_STAGES: OpportunityStage[] = [
  "LEAD",
  "QUALIFIED",
  "DATA_COLLECTION",
  "SITE_ASSESSMENT_PENDING",
  "CONCEPT_DESIGN",
  "BUDGETARY_PROPOSAL",
  "FIRM_PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
];

// From any active stage you can jump to any other active stage, plus WON / LOST / ON_HOLD.
// This means a director can fast-track a deal directly to WON or correct a mis-staged opportunity.
function allExcept(...excluded: OpportunityStage[]): OpportunityStage[] {
  const all: OpportunityStage[] = [...PIPELINE_STAGES, "WON", "LOST", "ON_HOLD"];
  return all.filter((s) => !excluded.includes(s));
}

export const OPPORTUNITY_STAGE_TRANSITIONS: Record<
  OpportunityStage,
  StageTransitionRule
> = {
  LEAD:                    { allowedNext: allExcept("LEAD") },
  QUALIFIED:               { allowedNext: allExcept("QUALIFIED") },
  DATA_COLLECTION:         { allowedNext: allExcept("DATA_COLLECTION") },
  SITE_ASSESSMENT_PENDING: { allowedNext: allExcept("SITE_ASSESSMENT_PENDING") },
  CONCEPT_DESIGN:          { allowedNext: allExcept("CONCEPT_DESIGN") },
  BUDGETARY_PROPOSAL:      { allowedNext: allExcept("BUDGETARY_PROPOSAL") },
  FIRM_PROPOSAL:           { allowedNext: allExcept("FIRM_PROPOSAL") },
  NEGOTIATION:             { allowedNext: allExcept("NEGOTIATION") },
  CONTRACTING:             { allowedNext: allExcept("CONTRACTING") },
  WON: {
    allowedNext: [], // terminal — project is created on entry
  },
  LOST: {
    allowedNext: [...PIPELINE_STAGES], // can re-open to any active stage
    requiresReason: true,
  },
  ON_HOLD: {
    allowedNext: [...PIPELINE_STAGES, "LOST"], // resume to any active stage or mark lost
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
