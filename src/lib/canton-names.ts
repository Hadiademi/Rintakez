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

/**
 * "in <canton>" as it reads in running text. German and French put an
 * article before some canton names (im Wallis, in der Waadt, en Valais,
 * au Tessin, aux Grisons), so "in {name}" is wrong for those; French also
 * reads more naturally as "dans le canton de …" for the multi-word and
 * half-canton names. English uses "in <name>" throughout.
 */
const CANTON_LOCATIVE: Record<Canton, { de: string; fr: string }> = {
  AG: { de: "im Aargau", fr: "en Argovie" },
  AI: { de: "in Appenzell Innerrhoden", fr: "dans le canton d'Appenzell Rhodes-Intérieures" },
  AR: { de: "in Appenzell Ausserrhoden", fr: "dans le canton d'Appenzell Rhodes-Extérieures" },
  BE: { de: "in Bern", fr: "à Berne" },
  BL: { de: "in Basel-Landschaft", fr: "dans le canton de Bâle-Campagne" },
  BS: { de: "in Basel-Stadt", fr: "dans le canton de Bâle-Ville" },
  FR: { de: "in Freiburg", fr: "à Fribourg" },
  GE: { de: "in Genf", fr: "à Genève" },
  GL: { de: "in Glarus", fr: "à Glaris" },
  GR: { de: "in Graubünden", fr: "aux Grisons" },
  JU: { de: "im Jura", fr: "dans le canton du Jura" },
  LU: { de: "in Luzern", fr: "à Lucerne" },
  NE: { de: "in Neuenburg", fr: "à Neuchâtel" },
  NW: { de: "in Nidwalden", fr: "dans le canton de Nidwald" },
  OW: { de: "in Obwalden", fr: "dans le canton d'Obwald" },
  SG: { de: "in St. Gallen", fr: "à Saint-Gall" },
  SH: { de: "in Schaffhausen", fr: "à Schaffhouse" },
  SO: { de: "in Solothurn", fr: "à Soleure" },
  SZ: { de: "in Schwyz", fr: "à Schwytz" },
  TG: { de: "im Thurgau", fr: "en Thurgovie" },
  TI: { de: "im Tessin", fr: "au Tessin" },
  UR: { de: "in Uri", fr: "dans le canton d'Uri" },
  VD: { de: "in der Waadt", fr: "dans le canton de Vaud" },
  VS: { de: "im Wallis", fr: "en Valais" },
  ZG: { de: "in Zug", fr: "à Zoug" },
  ZH: { de: "in Zürich", fr: "à Zurich" },
};

export function cantonLocative(canton: Canton, locale: string): string {
  const entry = CANTON_LOCATIVE[canton];
  if (!entry) return `in ${canton}`;
  if (locale === "en") return `in ${cantonName(canton, "en")}`;
  return locale === "fr" ? entry.fr : entry.de;
}

/**
 * Select / chip options for cantons: the code as value (what is stored), the
 * localized name as label, sorted by that name in the given language.
 */
export function cantonOptions(locale: string): { value: Canton; label: string }[] {
  return (Object.keys(CANTON_NAMES) as Canton[])
    .map((c) => ({ value: c, label: cantonName(c, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
