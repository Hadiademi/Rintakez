import { z } from "zod";

export const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR",
  "JU", "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG",
  "TI", "UR", "VD", "VS", "ZG", "ZH",
] as const;

export const SHOOT_TYPES = [
  "wedding", "portrait", "commercial", "event", "architecture", "family", "other",
] as const;

export const DISCIPLINES = ["photo", "video"] as const;

export const photographerDetailsSchema = z.object({
  specialties: z.array(z.enum(SHOOT_TYPES)).min(1).max(7),
  disciplines: z.array(z.enum(DISCIPLINES)).min(1),
  coverageCantons: z.array(z.enum(CANTONS)).min(1),
  hourlyRateChf: z
    .number()
    .int()
    .positive()
    .max(100_000)
    .optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
});

export type PhotographerDetailsInput = z.infer<typeof photographerDetailsSchema>;

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
