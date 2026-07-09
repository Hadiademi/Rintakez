import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Low-risk, enforcing site-wide security headers. These don't change app
// behavior — they just tell browsers to be stricter about how the site is
// embedded/loaded.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Derive the configured Supabase origin (both REST and realtime schemes) from
// env at build time so connect-src can be explicit rather than relying only
// on the broad `https:`/`wss:` fallback below. This matters for local/
// self-hosted Supabase over plain HTTP (ws://127.0.0.1:54321 realtime), which
// a `wss:`-only policy would silently block.
function supabaseConnectOrigins(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const u = new URL(url);
    const wsProtocol = u.protocol === "https:" ? "wss:" : "ws:";
    return [`${u.protocol}//${u.host}`, `${wsProtocol}//${u.host}`];
  } catch {
    return [];
  }
}

// Content-Security-Policy: allows self + Supabase REST/realtime (https:/wss:,
// plus the exact configured origin so local ws:// Supabase also works) +
// images from data:/blob:/https: (avatars, Unsplash, Supabase storage) +
// inline styles (Tailwind runtime) + Next's inline hydration scripts. Verified
// against a production build (landing, login, /home, directory, shoot detail,
// messages, pricing) with zero console violations, so it ships enforcing
// rather than report-only.
const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-eval' ONLY in development — React dev mode uses eval() for
  // debugging (HMR/callstacks); production React never does, so prod ships
  // without it (stricter). Omitting it in dev breaks `next dev` with CSP
  // eval violations.
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  ["connect-src", "'self'", "https:", "wss:", ...supabaseConnectOrigins()].join(" "),
  "font-src 'self' data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: cspDirectives }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
