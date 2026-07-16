import { ImageResponse } from "next/og";

// Static brand Open Graph card, used as the default social preview for any
// page under a locale that doesn't define its own opengraph-image (e.g. the
// photographer profile route overrides this with a per-photographer card).
export const alt = "Framly — Photo & Video Marketplace Switzerland";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens mirrored from src/app/globals.css (light theme): paper #fff,
// ink #0a0a0a, accent ~#c8462c. Kept as literal hex here since ImageResponse
// renders outside the CSS cascade.
const PAPER = "#ffffff";
const INK = "#0a0a0a";
const ACCENT = "#c8462c";

export default async function Image() {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
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
            Framly
          </span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: -2,
            color: INK,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Photo & video. Direct. Across Switzerland.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 28,
            color: "#555555",
            maxWidth: 820,
          }}
        >
          Find and book verified photographers and videographers near you.
        </div>
      </div>
    ),
    { ...size }
  );
}
