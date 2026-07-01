import type { CANTONS } from "@/lib/validation/photographer";

type Canton = (typeof CANTONS)[number];

/**
 * Full, localized canton display names keyed by the 2-letter code stored in
 * `coverage_cantons`/`profiles.canton`. Used for programmatic SEO landing
 * pages (e.g. "Hochzeitsfotografen in Zürich") and anywhere else a canton
 * code needs to read as a real place name instead of an abbreviation.
 */
export const CANTON_NAMES: Record<Canton, Record<"de" | "fr" | "en", string>> = {
  AG: { de: "Aargau", fr: "Argovie", en: "Aargau" },
  AI: { de: "Appenzell Innerrhoden", fr: "Appenzell Rhodes-Intérieures", en: "Appenzell Innerrhoden" },
  AR: { de: "Appenzell Ausserrhoden", fr: "Appenzell Rhodes-Extérieures", en: "Appenzell Ausserrhoden" },
  BE: { de: "Bern", fr: "Berne", en: "Bern" },
  BL: { de: "Basel-Landschaft", fr: "Bâle-Campagne", en: "Basel-Landschaft" },
  BS: { de: "Basel-Stadt", fr: "Bâle-Ville", en: "Basel-Stadt" },
  FR: { de: "Freiburg", fr: "Fribourg", en: "Fribourg" },
  GE: { de: "Genf", fr: "Genève", en: "Geneva" },
  GL: { de: "Glarus", fr: "Glaris", en: "Glarus" },
  GR: { de: "Graubünden", fr: "Grisons", en: "Graubünden" },
  JU: { de: "Jura", fr: "Jura", en: "Jura" },
  LU: { de: "Luzern", fr: "Lucerne", en: "Lucerne" },
  NE: { de: "Neuenburg", fr: "Neuchâtel", en: "Neuchâtel" },
  NW: { de: "Nidwalden", fr: "Nidwald", en: "Nidwalden" },
  OW: { de: "Obwalden", fr: "Obwald", en: "Obwalden" },
  SG: { de: "St. Gallen", fr: "Saint-Gall", en: "St. Gallen" },
  SH: { de: "Schaffhausen", fr: "Schaffhouse", en: "Schaffhausen" },
  SO: { de: "Solothurn", fr: "Soleure", en: "Solothurn" },
  SZ: { de: "Schwyz", fr: "Schwytz", en: "Schwyz" },
  TG: { de: "Thurgau", fr: "Thurgovie", en: "Thurgau" },
  TI: { de: "Tessin", fr: "Tessin", en: "Ticino" },
  UR: { de: "Uri", fr: "Uri", en: "Uri" },
  VD: { de: "Waadt", fr: "Vaud", en: "Vaud" },
  VS: { de: "Wallis", fr: "Valais", en: "Valais" },
  ZG: { de: "Zug", fr: "Zoug", en: "Zug" },
  ZH: { de: "Zürich", fr: "Zurich", en: "Zürich" },
};

export function cantonName(canton: Canton, locale: string): string {
  const entry = CANTON_NAMES[canton];
  if (!entry) return canton;
  return entry[locale as "de" | "fr" | "en"] ?? entry.de;
}
