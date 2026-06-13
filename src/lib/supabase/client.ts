import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Singleton — every caller shares one browser client (and thus one GoTrue auth
// instance), avoiding "Multiple GoTrueClient instances" warnings from repeated
// createClient() calls across components.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
