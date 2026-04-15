// Domain-specific AI prompt templates for the Solaroo RE CRM copilot.
// All prompts are modular, domain-specific, and permission-aware at the call site.

export const SYSTEM_PROMPT_BASE = `
You are an internal AI assistant for Solaroo RE CRM, a project management system for off-grid solar, hybrid solar-diesel, and battery energy storage (BESS) projects.

Your role is to help internal team members (sales engineers, project managers, design engineers, procurement, O&M) by:
- Summarizing project status and documents
- Extracting structured data from uploaded reports and drawings
- Drafting proposal summaries, follow-up emails, and handover notes
- Answering questions from internal project data
- Highlighting missing data, delays, or inconsistencies

Rules you must follow:
- Never directly modify project records. Only draft suggestions for the user to confirm.
- Always cite the source document or data point when answering from project data.
- Respect that margin and commercial sensitivity data may be restricted — do not include it unless the context explicitly provides it.
- Stay domain-focused: solar offgrid, BESS, hybrid solar-diesel, diesel displacement, microgrid.
- Respond concisely and in a professional engineering/commercial tone.
`.trim();

export const PROMPTS = {
  summarizeDocument: (docTitle: string, content: string) => `
Summarize the following project document titled "${docTitle}".

Extract and list:
1. Key technical parameters (capacity, equipment, topology)
2. Key commercial terms (if present)
3. Outstanding actions or open items
4. Any risks or concerns mentioned

Document content:
---
${content}
---
`.trim(),

  extractProposalAssumptions: (content: string) => `
Extract the technical and commercial assumptions from the following proposal or design document.

Return a structured list of:
- Load assumptions (daily energy, peak demand, load source)
- Solar sizing (kWp, yield assumption)
- BESS sizing (kW, kWh, usable DoD, efficiency)
- Generator assumptions (if any)
- Diesel price assumption (if any)
- O&M assumptions
- Any other design assumptions stated

Document:
---
${content}
---
`.trim(),

  draftProposalSummary: (context: {
    clientName: string;
    siteName: string;
    pvKwp?: number;
    bessKw?: number;
    bessKwh?: number;
    commercialModel: string;
    savings?: string;
    payback?: string;
  }) => `
Draft a professional executive summary paragraph for a solar/BESS project proposal with the following parameters:

Client: ${context.clientName}
Site: ${context.siteName}
Solar PV: ${context.pvKwp ? `${context.pvKwp} kWp` : "TBD"}
BESS: ${context.bessKw ? `${context.bessKw} kW / ${context.bessKwh} kWh` : "TBD"}
Commercial model: ${context.commercialModel}
Estimated savings: ${context.savings ?? "TBD"}
Payback period: ${context.payback ?? "TBD"}

Write 2-3 sentences suitable for the opening of a commercial proposal. Professional, factual, no filler words.
`.trim(),

  answerProjectQuestion: (question: string, projectContext: string) => `
Answer the following question about a project, using only the data provided below.
If the answer is not available in the data, say so clearly.

Question: ${question}

Project data:
---
${projectContext}
---
`.trim(),

  summarizeProjectStatus: (projectContext: string) => `
Provide a concise project status summary based on the data below.

Include:
1. Current stage / gate
2. Key milestones: on-track, delayed, or upcoming
3. Open issues and risks (critical ones first)
4. Procurement status
5. Recommended next actions

Project data:
---
${projectContext}
---
`.trim(),

  draftFollowUpEmail: (context: {
    recipientName: string;
    subject: string;
    keyPoints: string[];
    senderName: string;
  }) => `
Draft a professional follow-up email for a solar/BESS project.

Recipient: ${context.recipientName}
Subject: ${context.subject}
Key points to include:
${context.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}
Sender: ${context.senderName}

Write in a professional but direct tone. No filler. Keep it under 150 words.
`.trim(),
};
