"use client";
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "./supabase/client";
import {
  type ChatNotificationLevel,
  fetchUnreadChatState,
} from "./chat-unread";

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
  // the effect graph. Delegates the actual query sequence to the shared
  // `fetchUnreadChatState` helper (also used by the trip hub server page),
  // so the client and server counts always agree.
  const recompute = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const next = await fetchUnreadChatState(supabase, tripId, user.id);
    setState(next);
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
