"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

// Unique storage key per realtime client so multiple instances never share an
// auth-storage lock (which would log "Multiple GoTrueClient instances").
let rtSeq = 0;

/**
 * Invisible, app-wide realtime listener that keeps the inbox list and the
 * unread badge (desktop nav + MobileTabBar) live. Mounted once in AppNav.
 *
 * The open thread already subscribes to its own messages (message-thread.tsx);
 * this component only reacts to messages from OTHER conversations by asking
 * the server tree to re-render, which recomputes `messagesUnread` in AppNav
 * and the conversation list in the messages layout. A refresh for the
 * currently-open thread is skipped: it self-updates via its own channel and a
 * full-tree refresh there is redundant and visually disruptive.
 */
export function MessagesLive({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // The conversation id of the open thread (path is locale-prefixed, e.g.
  // /de/messages/<id>), mirrored into a ref so the realtime callback reads a
  // fresh value without re-subscribing on every navigation.
  const openConversationId = pathname.match(/\/messages\/([^/?#]+)/)?.[1] ?? null;
  const openConversationRef = useRef(openConversationId);
  useEffect(() => {
    openConversationRef.current = openConversationId;
  }, [openConversationId]);

  useEffect(() => {
    // Dedicated realtime client seeded with the user's access token — mirrors
    // notification-bell.tsx. RLS on `messages` only delivers rows from
    // conversations this user participates in, so no per-conversation filter
    // is needed (and the anon key alone would not pass RLS).
    const rt = createRealtimeClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: `sb-rt-messages-live-${++rtSeq}`,
        },
      }
    );

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function onInsert(payload: { new: Record<string, unknown> }) {
      const row = payload.new as {
        sender_id: string;
        conversation_id: string;
      };
      // Ignore my own echo — the sender's own UI already updated optimistically.
      if (row.sender_id === userId) return;
      // Skip messages for the currently-open thread: it self-updates via its
      // own channel, so a full-tree refresh here is redundant and disruptive.
      // Other conversations still refresh (inbox list + unread badge liveness).
      if (row.conversation_id === openConversationRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      // Coalesce bursts of incoming messages into a single refresh.
      debounceTimer = setTimeout(() => {
        router.refresh();
      }, 400);
    }

    const channel = rt.channel(`messages-live:${userId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      onInsert
    );

    let cancelled = false;
    (async () => {
      const { data } = await createBrowserClient().auth.getSession();
      if (cancelled || !data.session) return;
      await rt.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      rt.removeChannel(channel);
      rt.realtime.disconnect();
    };
  }, [userId, router]);

  return null;
}
