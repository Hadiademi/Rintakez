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
