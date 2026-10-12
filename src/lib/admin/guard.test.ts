import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Next renders a route's page segment independently of its layout (and skips
// layouts the client claims to have mounted), so the (admin) layout cannot be
// the only is_admin check. These invariants keep every admin read behind the
// shared gate in src/lib/admin/guard.ts. Behavioural proof lives in
// e2e/admin-flow.spec.ts ("a non-admin receives no admin data").
const ADMIN_ROUTES = join(process.cwd(), "src/app/[locale]/(admin)");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("admin route gating", () => {
  const all = files(ADMIN_ROUTES);
  const pages = all.filter((f) => f.endsWith("page.tsx"));

  it("finds the admin pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(7);
  });

  it("no admin route creates a service-role client directly", () => {
    const offenders = all.filter((f) => readFileSync(f, "utf8").includes("createAdminClient"));
    expect(offenders).toEqual([]);
  });

  it("every admin page passes through the admin gate itself", () => {
    const ungated = pages.filter(
      (f) => !/\b(adminPageClient|requireAdminProfile)\(/.test(readFileSync(f, "utf8"))
    );
    expect(ungated).toEqual([]);
  });

  it("the shared admin counts helper is gated too", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/admin/fetch-counts.ts"), "utf8");
    expect(src).not.toContain("createAdminClient");
    expect(src).toMatch(/\badminPageClient\(/);
  });
});
