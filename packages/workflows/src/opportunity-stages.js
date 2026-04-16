"use strict";
// Defines valid opportunity stage transitions.
// Active pipeline stages allow free movement to any other stage (forward, backward, or to terminal).
// This lets sales and directors fast-track deals or correct stage without friction.
// WON is terminal (project created on entry). LOST requires a reason.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPPORTUNITY_STAGE_TRANSITIONS = void 0;
exports.canTransitionStage = canTransitionStage;
exports.assertValidTransition = assertValidTransition;

// All active (non-terminal) pipeline stages
const PIPELINE_STAGES = [
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

function allExcept(...excluded) {
    const all = [...PIPELINE_STAGES, "WON", "LOST", "ON_HOLD"];
    return all.filter((s) => !excluded.includes(s));
}

exports.OPPORTUNITY_STAGE_TRANSITIONS = {
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

function canTransitionStage(from, to) {
    const rule = exports.OPPORTUNITY_STAGE_TRANSITIONS[from];
    return rule.allowedNext.includes(to);
}
function assertValidTransition(from, to) {
    if (!canTransitionStage(from, to)) {
        throw new Error(`Invalid stage transition: ${from} → ${to}. Allowed: ${exports.OPPORTUNITY_STAGE_TRANSITIONS[from].allowedNext.join(", ") || "none"}`);
    }
}
