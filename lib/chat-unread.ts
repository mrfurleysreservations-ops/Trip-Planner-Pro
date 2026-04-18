// Chat unread bookkeeping — level-aware.
//
// All unread counters in the app funnel through here so that
// `trip_members.chat_notification_level` is honored consistently:
//
//   'muted'     → 0 unread, gray dot on the chat tab
//   'mentions'  → only @mentions of the viewer count as unread
//   'all'       → every message from someone else counts (legacy behavior)
//
// v1 mention detection: parse `@name` tokens out of the message body and
// match against the viewer's `trip_members.name`. No dedicated mentions
// column yet — when we add one later, only `matchesMention` needs to
// change. Keeping the logic pure + synchronous makes it easy to reuse
// across server pages (chats, dashboard) and client views (sub-nav hook).

import type { TripMessage } from "@/types/database.types";

export type ChatNotificationLevel = "all" | "mentions" | "muted";

/** Normalize arbitrary string input from the DB into one of the known levels. */
export function normalizeChatLevel(level: string | null | undefined): ChatNotificationLevel {
  if (level === "muted" || level === "mentions" || level === "all") return level;
  return "all";
}

/**
 * Returns true if the message body tags the viewer via an `@name` token.
 *
 * Matching is case-insensitive, spaces in the name are collapsed (so
 * "@JaneDoe" matches "Jane Doe"), and the match must end at a non-word
 * boundary so `@jane` doesn't accidentally match `@janet`.
 */
export function matchesMention(message: TripMessage, viewerName: string | null | undefined): boolean {
  if (!viewerName) return false;
  const trimmed = viewerName.trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/\s+/g, "").toLowerCase();
  if (!normalized) return false;

  const body = (message.content || "").toLowerCase();
  if (!body.includes("@")) return false;

  // Walk each `@token` in the body — a token is `@` followed by word chars
  // (letters, digits, underscore). Compare the contiguous alphanumeric
  // prefix against the collapsed viewer name. Any prefix up to the length
  // of the viewer's name that matches counts as a tag.
  const regex = /@([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    const token = m[1].toLowerCase();
    if (token === normalized) return true;
  }
  return false;
}

export interface UnreadInputs {
  /** Messages that are newer than last_read_at, from senders other than the viewer. */
  unreadMessages: TripMessage[];
  level: ChatNotificationLevel;
  viewerName: string | null | undefined;
}

/**
 * Apply the viewer's notification-level filter to an already-narrowed list
 * of unread messages. Callers are expected to have excluded the viewer's
 * own sends and messages at-or-before `last_read_at` upstream.
 */
export function filterUnreadByLevel({ unreadMessages, level, viewerName }: UnreadInputs): TripMessage[] {
  if (level === "muted") return [];
  if (level === "mentions") {
    return unreadMessages.filter((m) => matchesMention(m, viewerName));
  }
  return unreadMessages;
}

export function countUnreadByLevel(inputs: UnreadInputs): number {
  return filterUnreadByLevel(inputs).length;
}
