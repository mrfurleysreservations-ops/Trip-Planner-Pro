"use client";
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "./supabase/client";
import {
  type ChatNotificationLevel,
  countUnreadByLevel,
  normalizeChatLevel,
} from "./chat-unread";
import type { TripMessage } from "@/types/database.types";

export interface TripChatUnreadState {
  count: number;
  level: ChatNotificationLevel;
}

/**
 * Client hook: per-trip unread chat count + the viewer's notification level,
 * both refreshed live via Supabase realtime. Used by `TripSubNav` to drive
 * the Chat tab badge styling (red count vs. gray dot vs. nothing).
 *
 * Design notes:
 *  - The hook resolves the auth user itself so callers don't have to thread
 *    it through every sub-nav mount.
 *  - We fetch the viewer's `trip_members.name` so `@mention` matching can
 *    happen locally for `level = 'mentions'` — no dedicated mentions column
 *    yet on `trip_messages`.
 *  - Realtime: subscribe to new messages on this trip, plus updates to the
 *    viewer's read marker, so that scrolling in /chat clears the dot on
 *    every other tab in real time.
 */
export function useTripChatUnread(tripId: string): TripChatUnreadState | null {
  const [state, setState] = useState<TripChatUnreadState | null>(null);

  // Recompute is defined as a stable callback so we can call it from the
  // realtime subscription, on mount, and on window focus without churning
  // the effect graph.
  const recompute = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberRow } = await supabase
      .from("trip_members")
      .select("name, chat_notification_level")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!memberRow) {
      // Trip owner without a member row — treat as level 'all' and use the
      // profile full_name as the mention target. Cheap fallback query.
      const { data: profileRow } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const { data: readRow } = await supabase
        .from("trip_message_reads")
        .select("last_read_at")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();
      const lastRead = readRow?.last_read_at ?? null;

      let q = supabase
        .from("trip_messages")
        .select("*")
        .eq("trip_id", tripId)
        .is("deleted_at", null)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (lastRead) q = q.gt("created_at", lastRead);
      const { data: msgs } = await q;

      const count = countUnreadByLevel({
        unreadMessages: (msgs ?? []) as TripMessage[],
        level: "all",
        viewerName: profileRow?.full_name ?? null,
      });
      setState({ count, level: "all" });
      return;
    }

    const level = normalizeChatLevel(memberRow.chat_notification_level);

    // Short-circuit for muted: skip the messages query entirely. The state
    // is a dot-only indicator and never shows a count, so we don't need to
    // know whether any messages exist.
    if (level === "muted") {
      setState({ count: 0, level: "muted" });
      return;
    }

    const { data: readRow } = await supabase
      .from("trip_message_reads")
      .select("last_read_at")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    const lastRead = readRow?.last_read_at ?? null;

    let q = supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", tripId)
      .is("deleted_at", null)
      .neq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (lastRead) q = q.gt("created_at", lastRead);
    const { data: msgs } = await q;

    const count = countUnreadByLevel({
      unreadMessages: (msgs ?? []) as TripMessage[],
      level,
      viewerName: memberRow.name,
    });
    setState({ count, level });
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await recompute();
      if (cancelled) return;
    };
    run();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`trip-chat-unread:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          if (!cancelled) recompute();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_messages",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          if (!cancelled) recompute();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_message_reads",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          if (!cancelled) recompute();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          // The viewer may have flipped their own chat_notification_level
          // from the in-chat settings sheet. Re-resolve.
          if (!cancelled) recompute();
        }
      )
      .subscribe();

    const onFocus = () => {
      if (!cancelled) recompute();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [tripId, recompute]);

  return state;
}
