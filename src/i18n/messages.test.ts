import { describe, expect, it } from "vitest";
import de from "./messages/de.json";
import en from "./messages/en.json";
import fr from "./messages/fr.json";

// Guards against translation drift: every locale must define exactly the same
// set of message keys. A missing key crashes next-intl at render time, and an
// extra key is dead weight that hides the fact a string was renamed elsewhere.

type Json = Record<string, unknown>;

/** Collect every leaf key path (dot-joined) from a nested message catalog. */
function flattenKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as Json, path)
      : [path];
  });
}

const REFERENCE = "en";
const enKeys = new Set(flattenKeys(en as Json));
const locales: Record<string, Json> = { de: de as Json, fr: fr as Json };

describe("i18n message catalogs", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    const keys = new Set(flattenKeys(messages));

    it(`${locale} defines every key present in ${REFERENCE}`, () => {
      const missing = [...enKeys].filter((k) => !keys.has(k));
      expect(missing, `${locale} is missing keys: ${missing.join(", ")}`).toEqual(
        []
      );
    });

    it(`${locale} has no keys absent from ${REFERENCE}`, () => {
      const extra = [...keys].filter((k) => !enKeys.has(k));
      expect(extra, `${locale} has unexpected keys: ${extra.join(", ")}`).toEqual(
        []
      );
    });
  }

  it("has no empty string values in any locale", () => {
    const offenders: string[] = [];
    for (const [locale, messages] of Object.entries({ en, de, fr })) {
      for (const path of flattenKeys(messages as Json)) {
        const value = path
          .split(".")
          .reduce<unknown>((acc, k) => (acc as Json)?.[k], messages);
        if (typeof value === "string" && value.trim() === "") {
          offenders.push(`${locale}:${path}`);
        }
      }
    }
    expect(offenders, `empty translations: ${offenders.join(", ")}`).toEqual([]);
  });
});
