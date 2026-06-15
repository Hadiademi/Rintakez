import { createBrowserClient } from "@supabase/ssr";
import { isDemo } from "@/lib/demo/flag";
import { createBrowserMockClient } from "@/lib/demo/browser-client";
import type { Database } from "./database.types";

// Singleton — every caller shares one browser client (and thus one GoTrue auth
// instance), avoiding "Multiple GoTrueClient instances" warnings from repeated
// createClient() calls across components.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (isDemo())
    return createBrowserMockClient() as unknown as ReturnType<
      typeof createBrowserClient<Database>
    >;
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
