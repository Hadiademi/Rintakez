import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The data export (revFADP Art. 25) reads photographer_details with an
// explicit column list, because SELECT on that table is column-scoped and
// excludes verification_note (read separately via my_verification_note()).
// A column added to the table but not to this list would silently drop out
// of the export; this test makes that a failure instead.
describe("data export: photographer_details columns", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("lists every column of the table except the note", () => {
    const types = read("src/lib/supabase/database.types.ts");
    const row = /photographer_details: \{\s*Row: \{([^}]+)\}/.exec(types);
    expect(row).not.toBeNull();
    const tableColumns = [...row![1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);

    const privacy = read("src/lib/actions/privacy.ts");
    const select = /\.from\("photographer_details"\)\s*\.select\(\s*"([^"]+)"/.exec(privacy);
    expect(select).not.toBeNull();
    const exported = select![1].split(",").map((c) => c.trim());

    expect(exported.sort()).toEqual(tableColumns.filter((c) => c !== "verification_note").sort());
    expect(privacy).toContain('rpc("my_verification_note")');
  });
});
