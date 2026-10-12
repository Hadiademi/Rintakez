import { describe, expect, it } from "vitest";
import { CANTONS } from "@/lib/validation/photographer";
import { cantonLocative, cantonName, cantonOptions } from "@/lib/canton-names";

// SEO landing pages read "Hochzeitsfotografen {inCanton}". "in {name}" is
// wrong for cantons that take an article (im Wallis, en Valais, au Tessin),
// which the review found live on indexed pages (I18N-10).
describe("cantonLocative", () => {
  it("uses the article where the canton name takes one", () => {
    expect(cantonLocative("VS", "de")).toBe("im Wallis");
    expect(cantonLocative("TI", "de")).toBe("im Tessin");
    expect(cantonLocative("AG", "de")).toBe("im Aargau");
    expect(cantonLocative("ZH", "de")).toBe("in Zürich");
    expect(cantonLocative("VS", "fr")).toBe("en Valais");
    expect(cantonLocative("TI", "fr")).toBe("au Tessin");
    expect(cantonLocative("GR", "fr")).toBe("aux Grisons");
    expect(cantonLocative("GE", "fr")).toBe("à Genève");
    expect(cantonLocative("VD", "fr")).toBe("dans le canton de Vaud");
    expect(cantonLocative("GE", "en")).toBe("in Geneva");
  });

  it("covers every canton in every language", () => {
    for (const c of CANTONS) {
      for (const l of ["de", "fr", "en"]) {
        const phrase = cantonLocative(c, l);
        expect(phrase, `${c}/${l}`).toContain(cantonName(c, l));
        expect(phrase, `${c}/${l}`).toMatch(/^(in|im|à|en|au|aux|dans le canton d)/);
      }
    }
  });

  it("falls back to German for an unknown locale", () => {
    expect(cantonLocative("VS", "it")).toBe("im Wallis");
  });
});

describe("cantonOptions", () => {
  // Dropdowns and chips showed the two-letter codes ("VS", "GR"); people
  // know their canton by name, in their language.
  it("labels every canton by its name in the given language, sorted by name", () => {
    const fr = cantonOptions("fr");
    expect(fr).toHaveLength(CANTONS.length);
    expect(fr.find((o) => o.value === "VS")?.label).toBe("Valais");
    expect(fr.find((o) => o.value === "GE")?.label).toBe("Genève");
    const labels = fr.map((o) => o.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "fr")));

    const de = cantonOptions("de");
    expect(de[0]).toEqual({ value: "AG", label: "Aargau" });
    expect(de.find((o) => o.value === "VS")?.label).toBe("Wallis");
  });
});

