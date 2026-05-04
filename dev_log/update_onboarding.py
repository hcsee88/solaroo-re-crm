"""
Append Section 6 — Sales Pipeline Discipline (V1) — to the existing
Solaroo_RE_CRM_Onboarding.docx, preserving all original styles, TOC, and
prior content.

After running, open the doc in Word and: right-click the TOC → Update Field →
Update entire table, to refresh the page numbers.
"""
import zipfile
import shutil
import os
import re
from xml.sax.saxutils import escape

HERE = os.path.dirname(__file__)
SRC  = os.path.join(HERE, "Solaroo_RE_CRM_Onboarding.docx")
TMP  = os.path.join(HERE, "Solaroo_RE_CRM_Onboarding.tmp.docx")

# ─── New content to append (style, text) ──────────────────────────────────────
# Styles match the existing document: Heading1, Heading2, Heading3, plus body
# paragraphs. Bullets reuse the document's existing list numbering (numId=1).

NEW_CONTENT = [
    ("Heading1", "6. Sales Pipeline Discipline (V1 — added April 2026)"),
    ("P", "This section documents the Sales Pipeline Discipline module added in April 2026. The earlier sections describe the original lifecycle; this section adds the activity-logging, next-action, health, and dashboard layers that now sit on top of every opportunity."),

    ("Heading2", "6.1 What was added"),
    ("Bullet", "Activity Timeline — every call, email, WhatsApp, meeting, site visit, or proposal follow-up is logged on the opportunity (and visible from the linked account, contact, and site)."),
    ("Bullet", "Next-Action Tracking — every open opportunity carries one structured next action (type, owner, due date)."),
    ("Bullet", "Opportunity Health — a coloured pill (Healthy · At Risk · Stale · Overdue) is computed at read time on every list row and detail page."),
    ("Bullet", "Sales Pipeline Dashboard — a dedicated page (sidebar → Sales Pipeline) summarising pipeline value, stage breakdown, follow-up backlog, proposal monitoring, and the closing forecast."),
    ("Bullet", "12 filter chips on the Opportunities list (My Open, Closing this month / quarter, No next action, Overdue, No activity 14d / 30d, Proposal submitted, High value, Won this month, Lost this month, Next-action status)."),
    ("Bullet", "3 new in-app notifications: Overdue next action (daily), Proposal awaiting follow-up (3d silence), Stale opportunity (14d silence). All routed via the existing bell + daily digest."),

    ("Heading2", "6.2 Activity types"),
    ("Bullet", "CALL — phone call (inbound or outbound)."),
    ("Bullet", "EMAIL — email correspondence."),
    ("Bullet", "WHATSAPP — WhatsApp / chat conversation."),
    ("Bullet", "MEETING — meeting (in-person or virtual)."),
    ("Bullet", "SITE_VISIT — on-site visit, optionally linked to a Site record."),
    ("Bullet", "PROPOSAL_FOLLOW_UP — specifically chasing an outstanding proposal."),
    ("Bullet", "GENERAL_NOTE — internal notes that don't fit the above."),
    ("P", "Every activity must link to at least one of: account, contact, site, or opportunity. When you log from inside one of those records, the link is auto-filled."),

    ("Heading2", "6.3 Next-action types"),
    ("Bullet", "FOLLOW_UP — generic follow-up call/email/message."),
    ("Bullet", "SITE_SURVEY — schedule or perform a technical site survey."),
    ("Bullet", "PROPOSAL_PREP — prepare or revise a proposal."),
    ("Bullet", "PROPOSAL_PRESENTATION — present the proposal to the customer."),
    ("Bullet", "NEGOTIATION — commercial negotiation step."),
    ("Bullet", "CONTRACT — send, review, or chase the contract."),
    ("Bullet", "INTERNAL_REVIEW — internal sign-off needed before next external step."),
    ("Bullet", "OTHER — anything else; describe in the notes field."),

    ("Heading2", "6.4 Health states"),
    ("Bullet", "Healthy (green) — recent activity, next action set and not overdue."),
    ("Bullet", "At Risk (amber) — either no next action set, or no activity in the last 14 days."),
    ("Bullet", "Stale (orange) — no activity logged in the last 30 days."),
    ("Bullet", "Overdue (red) — next action is past its due date and still PENDING."),
    ("P", "Closed opportunities (WON or LOST) are always Healthy — the health flag only applies to live deals. Health is computed at read time, never stored."),

    ("Heading2", "6.5 Daily workflow for sales"),
    ("Num", "Open the Sales Pipeline page (sidebar → Sales Pipeline). Scan Follow-up monitoring and Closing forecast."),
    ("Num", "Open the Opportunities list. Click the My Open chip, then the Overdue chip. Work the red rows first."),
    ("Num", "On each opportunity, log every conversation as an activity (Subject + short body)."),
    ("Num", "After logging, update the next action: type, owner, due date. If the deal is done for now, mark complete and immediately set the next next-action."),
    ("Num", "End of day: any Stale or At Risk row should have either a logged activity or a future next action by close of business."),

    ("Heading2", "6.6 How to log an activity"),
    ("Num", "Open the opportunity, scroll to the Activity Timeline panel."),
    ("Num", "Click Log activity at the top right of the panel."),
    ("Num", "Pick a type chip (CALL, EMAIL, WHATSAPP, MEETING, SITE_VISIT, PROPOSAL_FOLLOW_UP, GENERAL_NOTE)."),
    ("Num", "Enter Subject (one short line), optional Body, Occurred at (defaults to now)."),
    ("Num", "Save. Activity appears at top of timeline and updates the opportunity health and last-activity time immediately."),
    ("P", "You can edit your own activity at any time. You can delete your own activity within 7 days of creation; after that, ask a Director. Sales Managers can edit/delete activities owned by their team."),

    ("Heading2", "6.7 Setting and updating the next action"),
    ("Num", "Click Edit on the Next Action panel on the opportunity detail page."),
    ("Num", "Pick Type (FOLLOW_UP, SITE_SURVEY, etc.)."),
    ("Num", "Pick Owner (defaults to you; reassign if it's a colleague's step)."),
    ("Num", "Set a realistic Due Date — the system flags it OVERDUE the moment the date passes."),
    ("Num", "Optional notes. Save."),
    ("P", "When you complete an action: open the panel → Mark complete → set the next one. An open opportunity should never be left without a next action — that triggers the At Risk flag."),

    ("Heading2", "6.8 Sales Pipeline dashboard sections"),
    ("Bullet", "Pipeline summary — open count, total weighted value, average deal size."),
    ("Bullet", "By stage — count and value per stage; spot where the pipeline is bunching."),
    ("Bullet", "Sales activity — activities logged this week vs last week, by type."),
    ("Bullet", "Follow-up monitoring — opportunities with overdue next actions, broken out by owner."),
    ("Bullet", "Proposal monitoring — proposals submitted with no follow-up activity in 3+ days."),
    ("Bullet", "Closing forecast — what is forecast to close this month / quarter, weighted."),
    ("Bullet", "Top 10 — the 10 highest-value open opportunities."),
    ("Bullet", "Won this month — recent closed business summary."),
    ("P", "Visibility: Sales Engineers see their own pipeline; Sales Managers see the team's; Directors see everything."),

    ("Heading2", "6.9 New notifications wired in this release"),
    ("Bullet", "next_action_overdue — fired once per day (worker tick = hourly, deduped within 22h) until the action is completed or rescheduled. Routes to the action owner and the opportunity owner."),
    ("Bullet", "proposal_no_followup — fired when a BUDGETARY_PROPOSAL or FIRM_PROPOSAL stage opportunity has no logged activity for 3 days. Routes to the opportunity owner."),
    ("Bullet", "opportunity_stale — fired when any open opportunity has no logged activity for 14 days. Routes to the opportunity owner."),
    ("P", "All three respect the existing daily-digest opt-in (User → notificationDigestEnabled). Dedupe is enforced via the Notification table itself — no new schema field was added."),

    ("Heading2", "6.10 New permissions"),
    ("Bullet", "activity:create:own — Sales Engineer."),
    ("Bullet", "activity:edit:own / activity:delete:own — owner of the activity (7-day delete window for non-Director)."),
    ("Bullet", "activity:view:assigned — PM, Project Engineer, Design Engineer (see activities on their assigned opps/projects)."),
    ("Bullet", "activity:view:team / edit:team / delete:team — Sales Manager."),
    ("Bullet", "activity:view:all / edit:all / delete:all — Director, PMO Manager, Finance Admin."),

    ("Heading2", "6.11 Worked example — proposal goes quiet"),
    ("Num", "After issuing a proposal, set the next action: FOLLOW_UP, due in 3 working days."),
    ("Num", "On the due date, call or message the customer."),
    ("Num", "Log the contact attempt as PROPOSAL_FOLLOW_UP regardless of whether they answered."),
    ("Num", "Reset the next action with a new due date — never leave it empty."),
    ("Num", "If 3 days pass with no logged activity, the system fires proposal_no_followup to your bell."),
    ("Num", "If 14 days pass with no activity, the system fires opportunity_stale and the row turns Stale on every list."),

    ("Heading2", "6.12 Do's and don'ts"),
    ("Bullet", "DO log activities the same day they happen — your timeline is the audit trail."),
    ("Bullet", "DO keep one and only one open next action per live opportunity."),
    ("Bullet", "DO use Saved Views to keep your daily working set small."),
    ("Bullet", "DO NOT delete activities to clean up the timeline — the 7-day delete window is for genuine mistakes."),
    ("Bullet", "DO NOT skip the next-action update after logging an activity — that is the most common cause of At Risk flags."),
    ("Bullet", "DO NOT use GENERAL_NOTE for everything — picking the right activity type is what powers the dashboard charts."),

    ("Heading2", "6.13 Related artefacts"),
    ("Bullet", "Solaroo_Sales_Pipeline_Onboarding.docx — standalone sales-onboarding guide (same material, narrower scope, designed for new-hire reading)."),
    ("Bullet", "Solaroo_CRM_Flowcharts.pptx — 10-slide visual deck of the full sales-to-project lifecycle, including swim-lane and stage-flow diagrams."),
    ("Bullet", "dev_log/dev_log_260427.txt — implementation log for this module (schema diffs, new endpoints, test checklist)."),
]

# ─── Build the new XML ────────────────────────────────────────────────────────

def make_para(style, text):
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return (f'<w:p>{style_xml}'
            f'<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
            f'</w:p>')

def make_bullet(text):
    return ('<w:p><w:pPr><w:pStyle w:val="ListBullet"/>'
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
            f'</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

def make_num(text, num_id):
    return ('<w:p><w:pPr><w:pStyle w:val="ListNumber"/>'
            f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>'
            f'</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

# ─── Read source, find max numId, append new ones for restartable lists ──────

with zipfile.ZipFile(SRC, "r") as z:
    document_xml = z.read("word/document.xml").decode("utf-8")
    try:
        numbering_xml = z.read("word/numbering.xml").decode("utf-8")
    except KeyError:
        numbering_xml = None

# Find existing numId values
existing_num_ids = [int(m) for m in re.findall(r'<w:num w:numId="(\d+)"', numbering_xml or "")]
next_num_id = (max(existing_num_ids) + 1) if existing_num_ids else 100

# Build body, allocating a fresh numId per Num run so each list starts at 1
body_parts = []
in_num = False
current_num_id = None
new_num_ids_needed = []

for style, text in NEW_CONTENT:
    if style == "Num":
        if not in_num:
            current_num_id = next_num_id
            new_num_ids_needed.append(current_num_id)
            next_num_id += 1
            in_num = True
        body_parts.append(make_num(text, current_num_id))
    else:
        in_num = False
        if style == "Bullet":
            body_parts.append(make_bullet(text))
        elif style in ("Heading1", "Heading2", "Heading3"):
            body_parts.append(make_para(style, text))
        else:
            body_parts.append(make_para(None, text))

new_xml_block = "".join(body_parts)

# ─── Insert before <w:sectPr> if present, else before </w:body> ──────────────
if "<w:sectPr" in document_xml:
    sect_match = re.search(r'(<w:sectPr\b)', document_xml)
    insert_pos = sect_match.start()
    new_document_xml = document_xml[:insert_pos] + new_xml_block + document_xml[insert_pos:]
elif "</w:body>" in document_xml:
    new_document_xml = document_xml.replace("</w:body>", new_xml_block + "</w:body>")
else:
    raise RuntimeError("Could not find sectPr or body close in document.xml")

# ─── Extend numbering.xml with new numId instances ───────────────────────────
new_numbering_xml = numbering_xml
if numbering_xml and new_num_ids_needed:
    # Find the abstractNumId used by an existing decimal list, fallback to 0
    decimal_abstract_id = None
    abstracts = re.findall(
        r'<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>(.*?)</w:abstractNum>',
        numbering_xml, re.S)
    for aid, body in abstracts:
        if 'w:numFmt w:val="decimal"' in body:
            decimal_abstract_id = aid
            break
    if decimal_abstract_id is None and abstracts:
        decimal_abstract_id = abstracts[0][0]
    if decimal_abstract_id is not None:
        additions = []
        for nid in new_num_ids_needed:
            additions.append(
                f'<w:num w:numId="{nid}">'
                f'<w:abstractNumId w:val="{decimal_abstract_id}"/>'
                f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>'
                f'</w:num>'
            )
        new_numbering_xml = numbering_xml.replace(
            "</w:numbering>", "".join(additions) + "</w:numbering>")

# ─── Write a new zip with the updated parts ──────────────────────────────────
with zipfile.ZipFile(SRC, "r") as zin, zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        name = item.filename
        if name == "word/document.xml":
            zout.writestr(item, new_document_xml)
        elif name == "word/numbering.xml" and new_numbering_xml is not None:
            zout.writestr(item, new_numbering_xml)
        else:
            zout.writestr(item, zin.read(name))

shutil.move(TMP, SRC)

print(f"Updated {SRC}")
print(f"Size: {os.path.getsize(SRC)} bytes")
print()
print("Reminder: open in Word, right-click the TOC → Update Field →")
print("Update entire table, so the new Section 6 appears with page numbers.")
