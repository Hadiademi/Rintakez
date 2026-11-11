import { z } from "zod";
import {
  LINK_LABEL_MAX,
  LINK_URL_MAX,
  MAX_LINKS,
  normalizeLinkUrl,
} from "@/lib/links";

export const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
] as const;

// Order mirrors the public.shoot_type enum, where 'sport' was added
// `after 'event'` (20261111120000_sport_shoot_type.sql). It is also the order
// the chips appear in on every form and filter.
export const SHOOT_TYPES = [
  "wedding", "portrait", "commercial", "event", "sport", "architecture", "family", "other",
] as const;

export const DISCIPLINES = ["photo", "video"] as const;

/** One public link. The URL is normalised (see src/lib/links.ts) so "www.x.ch"
 *  and "@handle" are accepted; anything that is not an http(s) web address is
 *  rejected on this row's `url`, which the editors map back to the input. */
const profileLinkSchema = z.object({
  url: z
    .string()
    .max(LINK_URL_MAX * 2)
    .transform((value, ctx) => {
      const url = normalizeLinkUrl(value);
      if (url === null) {
        ctx.addIssue({ code: "custom", message: "invalid_link" });
        return z.NEVER;
      }
      return url;
    }),
  label: z
    .string()
    .trim()
    .max(LINK_LABEL_MAX)
    .nullish()
    .transform((value) => (value ? value : null)),
});

export const photographerDetailsSchema = z.object({
  specialties: z.array(z.enum(SHOOT_TYPES)).min(1).max(SHOOT_TYPES.length),
  disciplines: z.array(z.enum(DISCIPLINES)).min(1),
  coverageCantons: z.array(z.enum(CANTONS)).min(1),
  hourlyRateChf: z
    .number()
    .int()
    .positive()
    .max(100_000)
    .optional(),
  links: z.array(profileLinkSchema).max(MAX_LINKS).default([]),
});

export type PhotographerDetailsInput = z.infer<typeof photographerDetailsSchema>;

export type DetailsFieldErrors = {
  hourlyRate?: "invalid_rate";
  /** Keyed by the link's row index. */
  links: Record<number, "invalid_link" | "invalid_link_label">;
  /** An issue no field can show (the editors disable saving before it can
   *  happen, so this is a fallback, not a normal path). */
  general: boolean;
};

/**
 * Place schema issues on the fields that caused them, so the form can say
 * "this link" instead of the old catch-all "please check your input" at the
 * bottom of the page — which left a photographer unable to find what to fix.
 * The editors run this with the same schema before calling the server action.
 */
export function detailsFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>
): DetailsFieldErrors {
  const out: DetailsFieldErrors = { links: {}, general: false };
  for (const { path } of issues) {
    const [field, row, part] = path;
    if (field === "hourlyRateChf") {
      out.hourlyRate = "invalid_rate";
    } else if (field === "links" && typeof row === "number") {
      out.links[row] = part === "label" ? "invalid_link_label" : "invalid_link";
    } else {
      out.general = true;
    }
  }
  return out;
}

// Portfolio is hard-capped at 20 images (DB trigger), so a reorder never carries
// more than that. Every entry must be a portfolio_images uuid.
export const reorderPortfolioSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(20);

export const PORTFOLIO_CAPTION_MAX = 280;

// A caption is trimmed; an empty/whitespace-only value clears it (→ null).
export const portfolioCaptionSchema = z.object({
  imageId: z.string().uuid(),
  caption: z
    .string()
    .max(PORTFOLIO_CAPTION_MAX * 2) // guard before trim; final length checked below
    .nullable()
    .transform((v) => {
      const trimmed = v?.trim() ?? "";
      return trimmed.length ? trimmed : null;
    })
    .refine((v) => v === null || v.length <= PORTFOLIO_CAPTION_MAX, {
      message: `Caption must be at most ${PORTFOLIO_CAPTION_MAX} characters`,
    }),
});

export type PortfolioCaptionInput = z.infer<typeof portfolioCaptionSchema>;

export type DetailsFormCheck =
  | { ok: true }
  | ({ ok: false } & DetailsFieldErrors);

/**
 * Client-side pre-check the onboarding and settings forms run before calling
 * savePhotographerDetails (which validates again — the server stays the
 * authority). `rowOf` comes from toLinkPayload(): it maps the i-th link in the
 * payload back to the editor row it came from, because empty rows are dropped
 * before validation.
 */
export function checkDetailsForm(raw: unknown, rowOf: number[]): DetailsFormCheck {
  const result = photographerDetailsSchema.safeParse(raw);
  if (result.success) return { ok: true };
  const errors = detailsFieldErrors(result.error.issues);
  const links: DetailsFieldErrors["links"] = {};
  for (const [index, code] of Object.entries(errors.links)) {
    links[rowOf[Number(index)] ?? Number(index)] = code;
  }
  return { ok: false, ...errors, links };
}
