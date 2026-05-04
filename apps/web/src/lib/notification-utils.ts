// Shared helpers used by NotificationBell and the /notifications full-page list.

// ─── Per-type accent colour ───────────────────────────────────────────────────

export function getAccentColor(type: string): string {
  if (type.startsWith("gate_submitted"))      return "#fdab3d"; // amber
  if (type.startsWith("gate_approved"))       return "#00ca72"; // green
  if (type.startsWith("gate_rejected"))       return "#e2445c"; // red
  if (type.startsWith("proposal_submitted"))  return "#0073ea"; // blue
  if (type.startsWith("proposal_approved"))   return "#00ca72"; // green
  if (type.startsWith("proposal_rejected"))   return "#e2445c"; // red
  if (type.startsWith("proposal_"))           return "#a25ddc"; // purple
  if (type.startsWith("opp_won"))             return "#00ca72"; // green
  if (type.startsWith("opp_lost"))            return "#e2445c"; // red
  if (type.startsWith("opp_"))                return "#0073ea"; // blue
  if (type.startsWith("deliverable_approved")) return "#00ca72"; // green
  if (type.startsWith("blocker_assigned"))    return "#e2445c"; // red
  if (type.startsWith("po_"))                 return "#fdab3d"; // amber
  if (type.startsWith("document_approved"))   return "#00ca72"; // green
  if (type.startsWith("document_rejected"))   return "#e2445c"; // red
  if (type.startsWith("project_member_added")) return "#0073ea"; // blue
  if (type.startsWith("contract_awarded"))             return "#00ca72"; // green
  if (type.startsWith("contract_handover_ready"))      return "#fdab3d"; // amber
  if (type.startsWith("contract_handover_completed"))  return "#00ca72"; // green
  if (type.startsWith("invoice_paid"))                 return "#00ca72"; // green
  if (type.startsWith("digest"))                       return "#a25ddc"; // purple
  if (type.startsWith("next_action_overdue"))          return "#a52840"; // red
  if (type.startsWith("proposal_no_followup"))         return "#fdab3d"; // amber
  if (type.startsWith("opportunity_stale"))            return "#fdab3d"; // amber
  return "#676879"; // grey default
}

// ─── Compact relative time ────────────────────────────────────────────────────

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
