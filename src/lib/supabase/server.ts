import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDemo } from "@/lib/demo/flag";
import { createMockClient } from "@/lib/demo/mock-client";
import type { Database } from "./database.types";

export async function createClient() {
  if (isDemo())
    return createMockClient() as unknown as ReturnType<
      typeof createServerClient<Database>
    >;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
      },
    }
  );
}
