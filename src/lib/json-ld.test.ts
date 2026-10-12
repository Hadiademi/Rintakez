import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { safeJsonLd } from "@/lib/json-ld";

// A photographer controls display_name/city, which land in JSON-LD on public
// pages. JSON.stringify leaves "<" and "/" alone, so this name would close the
// <script> element and run attacker code for every visitor.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const BREAKOUT = '</script><script>alert(document.domain)</script>';

function renderLdScript(data: unknown): string {
  return renderToStaticMarkup(
    createElement("script", {
      type: "application/ld+json",
      dangerouslySetInnerHTML: { __html: safeJsonLd(data) },
    })
  );
}

describe("safeJsonLd", () => {
  it("cannot close the surrounding <script> element", () => {
    const html = renderLdScript({ "@type": "Person", name: BREAKOUT });
    // Exactly one closing tag: the element's own.
    expect(html.match(/<\/script/gi)).toHaveLength(1);
    expect(html.endsWith("</script>")).toBe(true);
  });

  it("emits no raw angle brackets or ampersands", () => {
    const out = safeJsonLd({ a: "<!-- x -->", b: "a & b", c: "<b>" });
    expect(out).not.toMatch(/[<>&]/);
  });

  it("escapes JS line terminators U+2028 / U+2029", () => {
    const out = safeJsonLd({ name: `a${LS}b${PS}c` });
    expect(out.includes(LS) || out.includes(PS)).toBe(false);
  });

  it("round-trips to the original value", () => {
    const value = {
      "@context": "https://schema.org",
      name: BREAKOUT,
      address: { addressLocality: "Zürich & <Umgebung>" },
      sep: `a${LS}b`,
      rating: 4.5,
    };
    expect(JSON.parse(safeJsonLd(value))).toEqual(value);
  });
});

describe("inline script sinks", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it("never feed a bare JSON.stringify into dangerouslySetInnerHTML", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((f) =>
      /__html:\s*JSON\.stringify/.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
