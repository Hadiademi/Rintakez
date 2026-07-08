import { createClient as createRealtimeClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "./client";
import type { Database } from "./database.types";

// ── ONE websocket per tab ──────────────────────────────────────────────
// Every `@supabase/supabase-js` client opens its own realtime websocket, and
// Supabase's concurrency ceiling is counted in websocket connections. Several
// components need live data (inbox liveness, the notification bell, the open
// thread), so instead of each calling createClient() (= a fresh socket) they
// all share THIS singleton and open their own multiplexed CHANNEL on it. Result:
// one socket per tab regardless of how many components are mounted — a ~2–3×
// lift on the exact scaling ceiling. The socket lives for the tab's lifetime;
// there is intentionally no disconnect() here (that would kill sibling channels).

type RealtimeClient = ReturnType<typeof createRealtimeClient<Database>>;

let shared: RealtimeClient | undefined;

/**
 * Lazily create (once, in the browser) the shared realtime client. Components
 * call this and open their own channel; the CLIENT (websocket) is shared, the
 * channels are not.
 *
 * Realtime RLS needs the user's access token, so on first creation we seed it
 * from the current session and keep it fresh across token refreshes via
 * onAuthStateChange (the SSR browser client auto-refreshes). Callers may still
 * do a defensive setAuth before their first subscribe(); that is fine.
 */
export function getRealtimeClient(): RealtimeClient {
  if (shared) return shared;

  // Realtime-only client — the token is set via setAuth, so it must not touch
  // the shared auth storage (avoids "Multiple GoTrueClient instances" warnings).
  shared = createRealtimeClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "sb-rt-shared",
      },
    }
  );

  // Only reach for a session in the browser; on the server there is none.
  if (typeof window !== "undefined") {
    const browser = createBrowserClient();
    // Seed the token now…
    void browser.auth.getSession().then(({ data }) => {
      if (data.session) void shared!.realtime.setAuth(data.session.access_token);
    });
    // …and keep it fresh across refreshes for the tab's lifetime.
    browser.auth.onAuthStateChange((_event, session) => {
      if (session) void shared!.realtime.setAuth(session.access_token);
    });
  }

  return shared;
}
