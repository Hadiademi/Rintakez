import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const LOCALES = ["de", "fr", "en"] as const;
// Routes that require a session. Public marketplace browsing (/shoots,
// /shoots/[id], /photographers) is intentionally NOT listed — anyone may browse;
// the login wall is at the moment of action (post/bid/message/save/contact).
const PROTECTED = [
  "/home",
  "/profile",
  "/my-shoots",
  "/my-bids",
  "/onboarding",
  "/shoots/new",
  "/messages",
  "/admin",
];

export async function updateSession(
  request: NextRequest,
  response: NextResponse
) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route gating: redirect unauthenticated users away from protected paths.
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = (LOCALES as readonly string[]).includes(segments[0])
    ? segments[0]
    : "de";
  const rest =
    "/" +
    segments.slice((LOCALES as readonly string[]).includes(segments[0]) ? 1 : 0).join("/");

  if (
    !user &&
    PROTECTED.some((p) => rest === p || rest.startsWith(p + "/"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return response;
}
