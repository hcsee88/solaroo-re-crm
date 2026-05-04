"""Generate Sales Pipeline Onboarding Guide as a .docx file using stdlib only."""
import zipfile
import os
from xml.sax.saxutils import escape

OUT = os.path.join(os.path.dirname(__file__), "Solaroo_Sales_Pipeline_Onboarding.docx")

# ─── Document content as a list of (style, text) tuples ───────────────────────
# style ∈ {"Title", "H1", "H2", "H3", "P", "Bullet", "Num", "Note"}

CONTENT = [
    ("Title",  "Solaroo RE CRM — Sales Pipeline Onboarding Guide"),
    ("P",      "Audience: New sales engineers, sales managers, and account owners."),
    ("P",      "Purpose: Show you exactly how to use the Sales Pipeline features so every opportunity stays healthy, every follow-up is logged, and nothing slips through the cracks."),
    ("P",      "Estimated reading time: 15 minutes. Estimated hands-on practice: 30 minutes."),

    ("H1",     "1. What changed and why it matters"),
    ("P",      "The CRM now enforces a discipline layer on top of the existing Opportunity record. You will see four new things every day:"),
    ("Bullet", "Activity Timeline — every call, email, WhatsApp, meeting, site visit, or proposal follow-up is logged on the opportunity, account, contact, or site."),
    ("Bullet", "Next Action Tracking — every open opportunity carries one structured next action with a type, owner, and due date."),
    ("Bullet", "Health Indicator — a coloured pill (Healthy / At Risk / Stale / Overdue) appears on every opportunity row and detail page so managers can spot stuck deals at a glance."),
    ("Bullet", "Sales Pipeline Dashboard — a dedicated page (sidebar → Sales Pipeline) that summarises pipeline value, stage breakdown, follow-up backlog, proposal monitoring, and the closing forecast for the current quarter."),
    ("Note",   "Why we built this: deals were going dark for weeks because nobody logged calls, and no one knew which proposals had been chased. This module makes the chase visible."),

    ("H1",     "2. The new vocabulary"),
    ("H2",     "2.1 Activity types"),
    ("Bullet", "CALL — Phone call (incoming or outgoing)."),
    ("Bullet", "EMAIL — Email correspondence."),
    ("Bullet", "WHATSAPP — WhatsApp / chat conversation."),
    ("Bullet", "MEETING — Meeting (in-person or virtual)."),
    ("Bullet", "SITE_VISIT — On-site visit, with optional Site link."),
    ("Bullet", "PROPOSAL_FOLLOW_UP — Specifically chasing an outstanding proposal."),
    ("Bullet", "GENERAL_NOTE — Any internal note or observation that does not fit the above."),

    ("H2",     "2.2 Next-action types"),
    ("Bullet", "FOLLOW_UP — Generic follow-up (call, email, message)."),
    ("Bullet", "SITE_SURVEY — Schedule or perform a technical site survey."),
    ("Bullet", "PROPOSAL_PREP — Prepare or revise a proposal."),
    ("Bullet", "PROPOSAL_PRESENTATION — Present the proposal to the customer."),
    ("Bullet", "NEGOTIATION — Commercial negotiation step."),
    ("Bullet", "CONTRACT — Send, review, or chase contract."),
    ("Bullet", "INTERNAL_REVIEW — Internal sign-off / review needed before next step."),
    ("Bullet", "OTHER — Anything that does not fit; describe it in the notes field."),

    ("H2",     "2.3 Health states"),
    ("Bullet", "Healthy (green) — Recent activity, next action set and not overdue."),
    ("Bullet", "At Risk (amber) — Either no next action set, or no activity in the last 14 days."),
    ("Bullet", "Stale (orange) — No activity logged in the last 30 days."),
    ("Bullet", "Overdue (red) — Next action is past its due date and still PENDING."),
    ("Note",   "Closed opportunities (WON or LOST) are always shown as Healthy — the health flag only applies to live deals."),

    ("H1",     "3. Daily workflow — what a sales engineer does each day"),
    ("Num",    "Open the Sales Pipeline page from the sidebar. Scan the Follow-up monitoring and Closing forecast sections."),
    ("Num",    "Open the Opportunities list. Click the My Open chip, then the Overdue chip. Work through the red rows first."),
    ("Num",    "On each opportunity, log every conversation as an activity (one line is fine — Subject + a short body)."),
    ("Num",    "After logging the activity, update the next action: type, owner, due date. If the deal is done for now, mark the next action complete."),
    ("Num",    "If a proposal has been issued and the customer has gone quiet, use the Proposal awaiting follow-up filter and chase those rows."),
    ("Num",    "End of day: scan your Health column. Anything Stale or At Risk should either have a logged activity or a future next action by close of business."),

    ("H1",     "4. How to log an activity"),
    ("P",      "You can log an activity from the Opportunity detail page, Account detail page, Contact detail page, or Site detail page. The fastest path is the opportunity detail page."),
    ("Num",    "Open the opportunity. Scroll to the Activity Timeline panel."),
    ("Num",    "Click the Log activity button at the top right of the panel."),
    ("Num",    "Pick the type chip (CALL, EMAIL, WHATSAPP, MEETING, SITE_VISIT, PROPOSAL_FOLLOW_UP, GENERAL_NOTE)."),
    ("Num",    "Enter a Subject (one short line — e.g., \"Customer asked for revised BoQ\")."),
    ("Num",    "Optional: enter a Body for any extra detail."),
    ("Num",    "Set the Occurred at timestamp (defaults to now — change it if you are back-logging)."),
    ("Num",    "Click Save. The activity appears at the top of the timeline and immediately updates the opportunity health and last activity time."),
    ("Note",   "Every activity must be linked to at least one of: account, contact, site, or opportunity. Logging from inside one of these records auto-fills the link, so you usually do not have to think about it."),

    ("H2",     "4.1 Editing or deleting an activity"),
    ("Bullet", "You can edit your own activity at any time."),
    ("Bullet", "You can delete your own activity within 7 days of creation. After that, ask a Director to delete it (we keep this window to protect the audit trail)."),
    ("Bullet", "Sales Managers can edit/delete activities owned by their team."),

    ("H1",     "5. Setting and updating the next action"),
    ("P",      "Every open opportunity should have exactly one structured next action. The Next Action panel sits near the top of the opportunity detail page."),
    ("Num",    "Click Edit on the Next Action panel."),
    ("Num",    "Pick a Type (FOLLOW_UP, SITE_SURVEY, etc.)."),
    ("Num",    "Pick an Owner (defaults to you, but reassign to a colleague if it is their step)."),
    ("Num",    "Set a Due Date — be realistic. The system will mark the action OVERDUE the moment the date passes."),
    ("Num",    "Optional: type a short description in the notes field (e.g., \"Call to confirm site survey window\")."),
    ("Num",    "Click Save."),
    ("P",      "When you have completed the action:"),
    ("Bullet", "Open the opportunity → Next Action panel → click Mark complete."),
    ("Bullet", "Then immediately set the next next action. An open opportunity should never be left with no next action — that is what triggers the At Risk flag."),
    ("Note",   "If the deal genuinely needs no next step right now (e.g., customer is on holiday for two weeks), set a FOLLOW_UP with a due date for when they return. Empty next-action slots are treated as a problem by the system."),

    ("H1",     "6. The Opportunities list — filter chips and saved views"),
    ("P",      "The Opportunities list now has 12 filter chips above the table. Combine them freely — they all AND together."),
    ("Bullet", "My Open — opportunities you own that are not WON or LOST."),
    ("Bullet", "Closing this month / Closing this quarter — by expected close date."),
    ("Bullet", "No next action — opportunities missing a next action altogether."),
    ("Bullet", "Overdue — next action past its due date."),
    ("Bullet", "No activity 14d / No activity 30d — silence detectors."),
    ("Bullet", "Proposal submitted — currently in BUDGETARY_PROPOSAL or FIRM_PROPOSAL."),
    ("Bullet", "High value — estimated value above the configured threshold."),
    ("Bullet", "Won this month / Lost this month — for retros and commissions."),
    ("P",      "Save any combination as a personal view via the Saved Views bar at the top. Name it (e.g., \"My chase list\") and one click brings it back the next morning."),

    ("H1",     "7. The Sales Pipeline dashboard"),
    ("P",      "Sidebar → Sales Pipeline. Sections, top to bottom:"),
    ("Bullet", "Pipeline summary — open count, total weighted value, average deal size."),
    ("Bullet", "By stage — count and value per stage, so you can see where the pipeline is bunching up."),
    ("Bullet", "Sales activity — number of activities logged this week vs last week, by type."),
    ("Bullet", "Follow-up monitoring — opportunities with overdue next actions, broken out by owner."),
    ("Bullet", "Proposal monitoring — proposals submitted with no follow-up activity in 3+ days."),
    ("Bullet", "Closing forecast — what is forecast to close this month and quarter, weighted."),
    ("Bullet", "Top 10 — the 10 highest-value open opportunities."),
    ("Bullet", "Won this month — summary of recently closed business."),
    ("Note",   "What you see depends on your role. Sales Engineers see their own pipeline; Sales Managers see the team; Directors see everything."),

    ("H1",     "8. Notifications you will receive"),
    ("P",      "The bell icon in the top bar will light up for these new sales-pipeline events:"),
    ("Bullet", "Overdue next action — fired once per day until you complete or reschedule the action. Goes to the action owner and the opportunity owner."),
    ("Bullet", "Proposal awaiting follow-up — fired when a proposal-stage opportunity has no logged activity for 3 days."),
    ("Bullet", "Stale opportunity — fired when any open opportunity has no logged activity for 14 days."),
    ("P",      "Open the bell to read each one, click through to the opportunity, and act."),

    ("H1",     "9. Common scenarios — worked examples"),

    ("H2",     "9.1 New inbound enquiry"),
    ("Num",    "Create the Account, Site, and Contact (if not already in the system)."),
    ("Num",    "Create the Opportunity, set yourself as owner."),
    ("Num",    "Log the inbound activity (e.g., CALL, Subject: \"Inbound enquiry — 200 kWp diesel hybrid\")."),
    ("Num",    "Set the next action: SITE_SURVEY, owner = yourself, due = within 7 days."),
    ("Num",    "Move the stage to QUALIFICATION."),

    ("H2",     "9.2 Proposal sent, customer goes quiet"),
    ("Num",    "After issuing the proposal, set the next action: FOLLOW_UP, due = 3 working days out."),
    ("Num",    "On the due date, call or message the customer."),
    ("Num",    "Log the contact attempt as an activity (PROPOSAL_FOLLOW_UP) regardless of whether they answered."),
    ("Num",    "Reset the next action with a new due date — never leave it empty."),
    ("Num",    "If 3 days pass with no logged activity, the system will notify you via the bell."),

    ("H2",     "9.3 Deal won"),
    ("Num",    "Open the opportunity, click Move Stage → WON."),
    ("Num",    "Fill in the WON dialog: contract value, project manager, expected start."),
    ("Num",    "The system auto-creates the Project record. Mark the next action complete."),
    ("Num",    "Log a final GENERAL_NOTE summarising the win (key terms, decision drivers — useful for the next similar deal)."),

    ("H2",     "9.4 Deal lost"),
    ("Num",    "Open the opportunity, click Move Stage → LOST."),
    ("Num",    "Pick a Lost reason from the dropdown and add a short comment."),
    ("Num",    "Mark the next action complete."),
    ("Note",   "Lost-reason data is what feeds the win/loss analysis — please be honest and specific. \"Price\" alone is not useful; \"Price — competitor 18% lower on BESS\" is."),

    ("H1",     "10. Do's and don'ts"),
    ("Bullet", "DO log activities the same day they happen — memory fades fast and the timeline is your audit trail."),
    ("Bullet", "DO keep one and only one open next action per live opportunity."),
    ("Bullet", "DO use the Saved Views to keep your daily working set small and focused."),
    ("Bullet", "DO NOT delete activities to \"clean up\" the timeline — the 7-day delete window is for genuine mistakes."),
    ("Bullet", "DO NOT skip the next-action update after logging an activity — that is the most common reason deals go At Risk."),
    ("Bullet", "DO NOT use GENERAL_NOTE for everything — picking the right activity type is what powers the dashboard charts."),

    ("H1",     "11. Where to get help"),
    ("Bullet", "Functional questions — your Sales Manager."),
    ("Bullet", "Bug or unexpected behaviour — message the CRM admin (see the in-app User Management page for the current admin contact)."),
    ("Bullet", "Permissions issue (\"I can't see X\") — ask the Director or PMO Manager to check your role."),

    ("H1",     "12. Quick reference card"),
    ("Bullet", "Log activity: Opportunity → Activity Timeline → Log activity."),
    ("Bullet", "Set next action: Opportunity → Next Action panel → Edit."),
    ("Bullet", "Find your overdue work: Sidebar → Sales Pipeline OR Opportunities → My Open + Overdue chips."),
    ("Bullet", "Find proposals to chase: Opportunities → Proposal submitted + No activity 14d chips."),
    ("Bullet", "Save a filter combo: Set the chips → Saved Views bar → Save view → name it."),
    ("Bullet", "See team activity: Sales Pipeline page → Sales activity section (managers/directors only)."),

    ("P",      "End of guide. Welcome to the team."),
]

# ─── XML scaffolding ──────────────────────────────────────────────────────────

NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

def p(text, style=None):
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{style_xml}<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'

def numbered(text, num_id):
    return ('<w:p><w:pPr><w:pStyle w:val="ListNumber"/>'
            f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>'
            f'</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

def bullet(text):
    return ('<w:p><w:pPr><w:pStyle w:val="ListBullet"/>'
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
            f'</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

# Build body, tracking when to start a new numbered list
body_parts = []
num_id_counter = 2  # numId 1 reserved for bullets; numbered lists get 2,3,4...
in_num = False
current_num_id = None

for style, text in CONTENT:
    if style == "Num":
        if not in_num:
            current_num_id = num_id_counter
            num_id_counter += 1
            in_num = True
        body_parts.append(numbered(text, current_num_id))
    else:
        in_num = False
        if style == "Title":
            body_parts.append(p(text, "Title"))
        elif style == "H1":
            body_parts.append(p(text, "Heading1"))
        elif style == "H2":
            body_parts.append(p(text, "Heading2"))
        elif style == "H3":
            body_parts.append(p(text, "Heading3"))
        elif style == "P":
            body_parts.append(p(text))
        elif style == "Bullet":
            body_parts.append(bullet(text))
        elif style == "Note":
            body_parts.append(p("Note: " + text, "IntenseQuote"))

document_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:document {NS}><w:body>'
    + ''.join(body_parts)
    + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
      '</w:sectPr>'
    '</w:body></w:document>'
)

# Build numbering.xml — one bullet abstract + one decimal abstract reused for every numbered run
abstract_bullet = '''<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'''
abstract_decimal = '''<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'''

# numId 1 -> bullet abstract; numId 2..N -> decimal abstract (each restart)
num_instances = ['<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>']
for nid in range(2, num_id_counter):
    num_instances.append(f'<w:num w:numId="{nid}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>')

numbering_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:numbering {NS}>'
    + abstract_bullet + abstract_decimal + ''.join(num_instances) +
    '</w:numbering>'
)

styles_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:styles {NS}>'
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0073EA"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="323338"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="323338"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:pPr><w:ind w:left="360" w:right="360"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:i/><w:color w:val="676879"/></w:rPr></w:style>'
    '</w:styles>'
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    '</Types>'
)

root_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '</Relationships>'
)

doc_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
    '</Relationships>'
)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", root_rels)
    z.writestr("word/document.xml", document_xml)
    z.writestr("word/styles.xml", styles_xml)
    z.writestr("word/numbering.xml", numbering_xml)
    z.writestr("word/_rels/document.xml.rels", doc_rels)

print(f"Wrote {OUT}")
print(f"Size: {os.path.getsize(OUT)} bytes")
