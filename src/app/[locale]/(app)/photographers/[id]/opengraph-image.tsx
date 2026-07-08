import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";

// Dynamic per-photographer Open Graph card: display name, location, and
// rating (when available) on the brand card. Falls back to the plain brand
// card (same visual language as the root [locale] opengraph-image) when the
// photographer can't be found — a missing/unpublished profile should never
// produce a broken share preview.
export const alt = "Rintakez photographer profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#ffffff";
const INK = "#0a0a0a";
const ACCENT = "#c8462c";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Slim, public-only fetch — just the fields this card renders. Uses the
  // same public (anon, RLS-safe) client as the profile page's cached data
  // loader, not the full profile query.
  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, city, canton")
    .eq("id", id)
    .maybeSingle();

  const isPhotographer = profile && profile.role === "photographer";

  let ratingLabel: string | null = null;
  if (isPhotographer) {
    const { data: rating } = await supabase
      .from("photographer_ratings")
      .select("avg_rating, review_count")
      .eq("photographer_id", id)
      .maybeSingle();
    if (rating?.review_count) {
      ratingLabel = `★ ${rating.avg_rating?.toFixed(1)} (${rating.review_count})`;
    }
  }

  const location = isPhotographer
    ? [profile.city, profile.canton].filter(Boolean).join(", ")
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: PAPER,
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 20,
              height: 20,
              borderRadius: 9999,
              backgroundColor: ACCENT,
            }}
          />
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: -1,
              color: INK,
              textTransform: "uppercase",
            }}
          >
            Rintakez
          </span>
        </div>

        {isPhotographer ? (
          <>
            <div
              style={{
                display: "flex",
                marginTop: 44,
                fontSize: 76,
                fontWeight: 600,
                letterSpacing: -2,
                color: INK,
                lineHeight: 1.05,
                maxWidth: 950,
              }}
            >
              {profile.display_name}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 24,
                gap: 20,
                fontSize: 30,
                color: "#555555",
              }}
            >
              {location ? <span style={{ display: "flex" }}>{location}</span> : null}
              {location && ratingLabel ? (
                <span style={{ display: "flex" }}>·</span>
              ) : null}
              {ratingLabel ? (
                <span style={{ display: "flex" }}>{ratingLabel}</span>
              ) : null}
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: -2,
              color: INK,
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            Photo & video. Direct. Across Switzerland.
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
