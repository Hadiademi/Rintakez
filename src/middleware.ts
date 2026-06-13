import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const handleI18n = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = handleI18n(request);
  return await updateSession(request, response);
}

export const config = {
  // `auth` is excluded so the locale-agnostic OAuth callback (/auth/callback)
  // is not rewritten into a locale-prefixed path by the i18n middleware.
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
