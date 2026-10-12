import { describe, expect, it } from "vitest";
import { CANTONS } from "@/lib/validation/photographer";
import { cantonLocative, cantonName } from "@/lib/canton-names";

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
