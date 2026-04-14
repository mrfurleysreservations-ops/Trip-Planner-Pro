// ─── Trip Activity Logger ───
// Reusable helper for logging activity events from client components.
// Import and call `logActivity(supabase, { ... })` after any mutation.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LogActivityParams {
  tripId: string;
  userId: string;
  userName: string;
  action: string;       // e.g. "created", "edited", "deleted", "finalized", "joined", "left", "updated"
  entityType: string;   // e.g. "note", "member", "trip", "itinerary_event"
  entityName: string;   // e.g. "The Grey — upscale restaurant"
  entityId?: string;    // The UUID of the entity (note, event, etc.) for deep linking
  detail?: string;      // Optional extra context
  linkPath?: string;    // e.g. "/trip/abc/notes" — where to navigate on click
}

export async function logActivity(supabase: SupabaseClient, params: LogActivityParams) {
  const { tripId, userId, userName, action, entityType, entityName, entityId, detail, linkPath } = params;
  const { error } = await supabase.from("trip_activity").insert({
    trip_id: tripId,
    user_id: userId,
    user_name: userName,
    action,
    entity_type: entityType,
    entity_name: entityName,
    entity_id: entityId || null,
    detail: detail || null,
    link_path: linkPath || null,
  });
  if (error) {
    console.error("logActivity error:", JSON.stringify(error, null, 2));
  }
}

// ─── Activity display helpers ───

const ACTION_ICONS: Record<string, string> = {
  created: "✨",
  edited: "✏️",
  deleted: "🗑️",
  finalized: "✅",
  joined: "👋",
  added: "➕",
  removed: "➖",
  updated: "📝",
  accepted: "✅",
  declined: "❌",
};

const ENTITY_ICONS: Record<string, string> = {
  note: "📝",
  member: "👤",
  trip: "🧭",
  itinerary_event: "📅",
};

export function getActivityIcon(action: string, entityType: string): string {
  return ACTION_ICONS[action] || ENTITY_ICONS[entityType] || "📌";
}

export function formatActivityMessage(action: string, entityType: string, entityName: string, userName: string): string {
  const entityLabel = entityType === "itinerary_event" ? "event" : entityType;
  return `${userName} ${action} ${entityLabel} "${entityName}"`;
}
